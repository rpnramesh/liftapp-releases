// ─────────────────────────────────────────────────────────────────────────────
// Lift Member App — Phone Auth via WebView (production reCAPTCHA)
// Loads Firebase compat SDK in a WebView with authDomain as baseUrl so that
// reCAPTCHA sees an authorised origin and invisible verification succeeds.
// Returns verificationId → RN verifies with signInWithCredential.
// ─────────────────────────────────────────────────────────────────────────────

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
const PRIMARY = '#1A56DB';


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
  <div id="status">Initialising…</div>

  <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"><\/script>
  <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"><\/script>
  <script>
    var config = ${FIREBASE_CONFIG};
    var app = firebase.initializeApp(config);
    var auth = firebase.auth();
    var verifier = null;
    var ready = false;
    var pendingPhone = null;

    function post(obj){
      try{ window.ReactNativeWebView.postMessage(JSON.stringify(obj)); }catch(e){}
    }

    window.onerror = function(msg, url, line) {
      post({type:'error', error:'JS Error: ' + msg + ' (line ' + line + ')'});
    };

    function initVerifier(){
      try{ if(verifier) verifier.clear(); }catch(e){}
      verifier = null; ready = false;
      document.getElementById('status').textContent='Setting up verification…';
      try{
        verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container',{
          size:'invisible',
          callback:function(){ post({type:'recaptcha-solved'}); },
          'expired-callback':function(){ post({type:'recaptcha-expired'}); initVerifier(); }
        });
        verifier.render().then(function(){
          ready = true;
          document.getElementById('status').textContent='Ready';
          post({type:'ready'});
          if(pendingPhone){ sendOtp(pendingPhone); }
        }).catch(function(e){
          document.getElementById('status').textContent='reCAPTCHA failed: '+e.message;
          post({type:'error', error:'reCAPTCHA init failed: '+e.message});
        });
      }catch(e){
        document.getElementById('status').textContent='Setup error: '+e.message;
        post({type:'error', error:'reCAPTCHA setup error: '+e.message});
      }
    }

    function sendOtp(phone){
      if(!verifier||!ready){
        pendingPhone=phone;
        post({type:'status', message:'Waiting for reCAPTCHA (ready='+ready+')'});
        return;
      }
      pendingPhone=null;
      document.getElementById('status').textContent='Sending OTP to '+phone+'…';
      auth.signInWithPhoneNumber(phone, verifier)
        .then(function(result){
          post({type:'verificationId', verificationId:result.verificationId});
        })
        .catch(function(e){
          var msg=e.message||'Failed to send OTP';
          if(e.code==='auth/too-many-requests') msg='Too many attempts. Try again later.';
          if(e.code==='auth/invalid-phone-number') msg='Invalid phone number format.';
          post({type:'error', error:msg, code:e.code||''});
          // Re-init verifier for next attempt
          initVerifier();
        });
    }

    // Listen for messages from React Native
    function handleMessage(event){
      try{
        var data = (typeof event.data === 'string') ? JSON.parse(event.data) : event.data;
        if(data.action==='sendOtp') sendOtp(data.phone);
        if(data.action==='ping') post({type:'pong', ready:ready});
      }catch(e){}
    }
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    // Start initializing
    initVerifier();
  <\/script>
</body>
</html>
`;

const PhoneAuthWebView = forwardRef((_, ref) => {
  const webViewRef = useRef(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [webviewKey, setWebviewKey] = useState(0);
  const pendingRef = useRef(null);
  const phoneRef = useRef(null);
  const readyRef = useRef(false);
  const retryRef = useRef(null);
  const failsafeRef = useRef(null);
  const reloadRef = useRef(null);

  const cleanup = useCallback(() => {
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    if (failsafeRef.current) { clearTimeout(failsafeRef.current); failsafeRef.current = null; }
    if (reloadRef.current) { clearTimeout(reloadRef.current); reloadRef.current = null; }
  }, []);

  // Auto-reload WebView if reCAPTCHA hasn't become ready after 15s
  useEffect(() => {
    if (readyRef.current) return;
    reloadRef.current = setTimeout(() => {
      if (!readyRef.current) {
        console.log('[PhoneAuth] No ready signal after 15s — reloading WebView');
        setWebviewKey(k => k + 1);
      }
    }, 15000);
    return () => { if (reloadRef.current) clearTimeout(reloadRef.current); };
  }, [webviewKey]);

  const injectSendOtp = useCallback((phone) => {
    const safePhone = phone.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webViewRef.current?.injectJavaScript(`
      sendOtp('${safePhone}');
      true;
    `);
  }, []);

  const onMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'ready':
          readyRef.current = true;
          // reCAPTCHA is ready — if we have a pending phone, send now
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

        case 'status':
          // Debug status from WebView
          break;

        case 'pong':
          // Response to ping — if ready, send OTP now
          if (data.ready && phoneRef.current && pendingRef.current) {
            readyRef.current = true;
            injectSendOtp(phoneRef.current);
          }
          break;

        case 'recaptcha-expired':
          readyRef.current = false;
          break;
      }
    } catch {}
  }, [cleanup, injectSendOtp]);

  useImperativeHandle(ref, () => ({
    sendOtp: (phoneNumber) => {
      return new Promise((resolve, reject) => {
        // Clean up any previous pending request
        cleanup();
        if (pendingRef.current) {
          pendingRef.current.reject(new Error('Cancelled'));
        }
        pendingRef.current = { resolve, reject };
        phoneRef.current = phoneNumber;
        setShowOverlay(true);

        // If WebView hasn't loaded yet, force reload it
        if (!readyRef.current) {
          setWebviewKey(k => k + 1);
        }

        // If reCAPTCHA was already ready (WebView pre-loaded), send immediately
        if (readyRef.current) {
          injectSendOtp(phoneNumber);
        }

        // Retry: ping WebView and re-inject every 3s
        const startRetries = () => {
          retryRef.current = setTimeout(function retry() {
            if (!pendingRef.current || !phoneRef.current) return;
            // Ping the WebView to check if it's ready
            webViewRef.current?.injectJavaScript(`
              if(typeof sendOtp==='function'){
                if(ready) sendOtp('${phoneNumber.replace(/'/g, "\\'")}');
                else post({type:'status',message:'Still waiting: ready='+ready});
              } else {
                post({type:'status',message:'sendOtp not defined yet'});
              }
              true;
            `);
            retryRef.current = setTimeout(retry, 3000);
          }, 3000);
        };
        startRetries();

        // Failsafe: reject after 60s
        failsafeRef.current = setTimeout(() => {
          if (pendingRef.current) {
            cleanup();
            setShowOverlay(false);
            pendingRef.current.reject(new Error('Verification timed out. Please check your internet connection and try again.'));
            pendingRef.current = null;
            phoneRef.current = null;
          }
        }, 60000);
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
          key={webviewKey}
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
              <ActivityIndicator color={PRIMARY} size="large" />
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
    color: '#6B7280',
    fontWeight: '500',
  },
});
