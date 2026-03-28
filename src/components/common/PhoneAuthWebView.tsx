// ─────────────────────────────────────────────────────────────────────────────
// Lift — Phone Auth via WebView (production reCAPTCHA)
// Loads Firebase compat SDK in a WebView with authDomain as baseUrl so that
// reCAPTCHA sees an authorised origin and invisible verification succeeds.
// Returns verificationId → RN verifies with signInWithCredential.
// ─────────────────────────────────────────────────────────────────────────────

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { C } from '../../constants/theme';

export interface PhoneAuthHandle {
  sendOtp: (phoneNumber: string) => Promise<string>;
  onReady?: (ready: boolean) => void;
}

const AUTH_DOMAIN = 'lift-bfd12.firebaseapp.com';

const FIREBASE_CONFIG = JSON.stringify({
  apiKey: 'AIzaSyBWfe4NVioDMI1b_VuZvkBsNCMJLnWI32M',
  authDomain: AUTH_DOMAIN,
  projectId: 'lift-bfd12',
  storageBucket: 'lift-bfd12.firebasestorage.app',
  messagingSenderId: '858368934869',
  appId: '1:858368934869:web:6c50951d112281909f335c',
});

const HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{margin:0;display:flex;align-items:center;justify-content:center;
         min-height:100vh;font-family:sans-serif;background:#fff}
    #status{color:#6B7280;font-size:14px;text-align:center;padding:20px}
    #recaptcha-container{position:absolute;top:0;left:0}
  </style>
</head>
<body>
  <div id="recaptcha-container"></div>
  <div id="status">Loading…</div>

  <script>
    var config = ${FIREBASE_CONFIG};
    var verifier = null;
    var ready = false;
    var pendingPhone = null;
    var otpSent = false;

    function post(obj){
      try{ window.ReactNativeWebView.postMessage(JSON.stringify(obj)); }catch(e){}
    }

    window.onerror = function(msg, url, line) {
      post({type:'error', error:'JS error: ' + msg});
    };

    function initFirebase(){
      try{
        var app = firebase.initializeApp(config);
        var auth = firebase.auth();
        initVerifier(auth);
      }catch(e){
        post({type:'error', error:'Firebase init failed: '+e.message});
      }
    }

    function initVerifier(auth){
      try{ if(verifier) verifier.clear(); }catch(e){}
      verifier = null; ready = false; otpSent = false;
      try{
        verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container',{
          size:'invisible',
          callback:function(){ },
          'expired-callback':function(){
            ready = false;
            setTimeout(function(){ initVerifier(auth); }, 500);
          }
        });
        verifier.render().then(function(){
          ready = true;
          post({type:'ready'});
          if(pendingPhone){ doSendOtp(auth, pendingPhone); pendingPhone=null; }
        }).catch(function(e){
          post({type:'error', error:'reCAPTCHA failed to load: '+e.message});
        });
      }catch(e){
        post({type:'error', error:'reCAPTCHA setup error: '+e.message});
      }

      window.__auth = auth;
    }

    function doSendOtp(auth, phone){
      if(otpSent) return;   // guard: only one active sign-in at a time
      otpSent = true;
      auth.signInWithPhoneNumber(phone, verifier)
        .then(function(r){ post({type:'verificationId', verificationId:r.verificationId}); })
        .catch(function(e){
          otpSent = false;  // allow retry on error
          var msg = e.message || 'Failed to send OTP';
          if(e.code==='auth/too-many-requests') msg='Too many attempts. Please try again later.';
          if(e.code==='auth/invalid-phone-number') msg='Invalid phone number format.';
          post({type:'error', error:msg, code:e.code||''});
          setTimeout(function(){ initVerifier(window.__auth); }, 200);
        });
    }

    function handleMessage(event){
      try{
        var data = (typeof event.data === 'string') ? JSON.parse(event.data) : event.data;
        if(data.action==='sendOtp'){
          if(!ready || !verifier){
            pendingPhone = data.phone;
            post({type:'status', message:'Queued — waiting for reCAPTCHA'});
          } else {
            doSendOtp(window.__auth, data.phone);
          }
        }
        if(data.action==='ping') post({type:'pong', ready:ready});
      }catch(e){}
    }
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    function loadScript(url, onLoad, onError){
      var s = document.createElement('script');
      s.src = url;
      s.onload = onLoad;
      s.onerror = onError;
      document.head.appendChild(s);
    }

    var PRIMARY_APP  = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js';
    var PRIMARY_AUTH = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js';
    var FALLBACK_APP  = 'https://cdn.jsdelivr.net/npm/firebase@10.14.1/firebase-app-compat.min.js';
    var FALLBACK_AUTH = 'https://cdn.jsdelivr.net/npm/firebase@10.14.1/firebase-auth-compat.min.js';

    function loadAuthScript(onDone){
      loadScript(PRIMARY_AUTH, onDone, function(){
        loadScript(FALLBACK_AUTH, onDone, function(){
          post({type:'error', error:'Could not load authentication library. Check your internet connection.'});
        });
      });
    }

    function loadAppScript(onDone){
      loadScript(PRIMARY_APP, onDone, function(){
        loadScript(FALLBACK_APP, onDone, function(){
          post({type:'error', error:'Could not load authentication library. Check your internet connection.'});
        });
      });
    }

    loadAppScript(function(){
      loadAuthScript(function(){
        initFirebase();
      });
    });
  <\/script>
</body>
</html>
`;

const PhoneAuthWebView = forwardRef<PhoneAuthHandle, { onReady?: (ready: boolean) => void }>(({ onReady }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [webviewKey] = useState(0);
  const pendingRef = useRef<{
    resolve: (id: string) => void;
    reject: (err: Error) => void;
  } | null>(null);
  const phoneRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    if (failsafeRef.current) { clearTimeout(failsafeRef.current); failsafeRef.current = null; }
  }, []);

  const injectSendOtp = useCallback((phone: string) => {
    const safePhone = phone.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webViewRef.current?.injectJavaScript(`
      (function(){
        if(typeof window.__auth !== 'undefined' && ready && verifier){
          doSendOtp(window.__auth, '${safePhone}');
        } else {
          pendingPhone = '${safePhone}';
        }
      })();
      true;
    `);
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'ready':
          readyRef.current = true;
          onReady?.(true);
          if (phoneRef.current && pendingRef.current) {
            injectSendOtp(phoneRef.current);
          }
          break;

        case 'verificationId':
          cleanup();
          setShowOverlay(false);
          pendingRef.current?.resolve(data.verificationId);
          pendingRef.current = null;
          phoneRef.current = null;
          break;

        case 'error':
          cleanup();
          setShowOverlay(false);
          pendingRef.current?.reject(new Error(data.error));
          pendingRef.current = null;
          phoneRef.current = null;
          break;

        case 'pong':
          if (data.ready) {
            readyRef.current = true;
            onReady?.(true);
            // Stop the retry loop — WebView confirmed it is alive and ready
            if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
            // One final inject as safety-net; WebView's otpSent guard prevents double-send
            if (phoneRef.current && pendingRef.current) {
              injectSendOtp(phoneRef.current);
            }
          }
          break;

        default:
          break;
      }
    } catch {}
  }, [cleanup, injectSendOtp, onReady]);

  useImperativeHandle(ref, () => ({
    sendOtp: (phoneNumber: string) => {
      return new Promise<string>((resolve, reject) => {
        cleanup();
        if (pendingRef.current) {
          pendingRef.current.reject(new Error('Cancelled'));
        }
        pendingRef.current = { resolve, reject };
        phoneRef.current = phoneNumber;
        setShowOverlay(true);

        if (readyRef.current) {
          injectSendOtp(phoneNumber);
        } else {
          webViewRef.current?.injectJavaScript(`
            pendingPhone = '${phoneNumber.replace(/'/g, "\\'")}';
            true;
          `);
        }

        const startRetries = () => {
          retryRef.current = setTimeout(function retry() {
            if (!pendingRef.current) return;
            webViewRef.current?.injectJavaScript(`
              post({type:'pong', ready:ready});
              true;
            `);
            retryRef.current = setTimeout(retry, 2000);
          }, 2000);
        };
        startRetries();

        failsafeRef.current = setTimeout(() => {
          if (pendingRef.current) {
            cleanup();
            setShowOverlay(false);
            pendingRef.current.reject(new Error(
              'OTP request timed out. Please tap \'Send OTP\' again.'
            ));
            pendingRef.current = null;
            phoneRef.current = null;
          }
        }, 90000);
      });
    },
  }));

  return (
    <>
      {/* WebView must stay ON-SCREEN for Android to keep JS execution active.
          A 1x1 container at bottom-right with overflow:hidden hides the 300x400
          WebView while keeping it in the viewport so reCAPTCHA can initialise. */}
      <View style={styles.webviewContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: HTML, baseUrl: `https://${AUTH_DOMAIN}` }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="compatibility"
          cacheEnabled
          style={styles.webview}
          originWhitelist={['*']}
          onError={(e) => {
            if (__DEV__) console.log('[PhoneAuth] WebView error:', e.nativeEvent);
            if (pendingRef.current) {
              cleanup();
              setShowOverlay(false);
              pendingRef.current.reject(new Error('Verification service failed to load. Please try again.'));
              pendingRef.current = null;
              phoneRef.current = null;
            }
          }}
        />
      </View>

      {/* Loading overlay shown only during OTP send */}
      {showOverlay && (
        <Modal visible transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.card}>
              <ActivityIndicator color={C.primary} size="large" />
              <Text style={styles.text}>Sending OTP…</Text>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
});

PhoneAuthWebView.displayName = 'PhoneAuthWebView';
export default PhoneAuthWebView;

const styles = StyleSheet.create({
  // MUST remain on-screen (not bottom:-500) so Android keeps JS alive
  // and reCAPTCHA can detect viewport visibility.
  webviewContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0.01,
  },
  webview: {
    width: 300,
    height: 400,
    backgroundColor: 'transparent',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    gap: 16,
    padding: 32,
    zIndex: 10,
  },
  text: {
    fontSize: 15,
    color: C.mid,
    fontWeight: '500',
  },
});
