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
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }

    function initVerifier(){
      try{ if(verifier) verifier.clear(); }catch(e){}
      verifier = null; ready = false;
      try{
        verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container',{
          size:'invisible',
          callback:function(){ post({type:'recaptcha-solved'}); },
          'expired-callback':function(){ post({type:'recaptcha-expired'}); initVerifier(); }
        });
        verifier.render().then(function(){
          ready = true;
          post({type:'ready'});
          if(pendingPhone) sendOtp(pendingPhone);
        }).catch(function(e){
          post({type:'error', error:'reCAPTCHA init failed: '+e.message});
        });
      }catch(e){
        post({type:'error', error:'reCAPTCHA setup error: '+e.message});
      }
    }

    function sendOtp(phone){
      if(!verifier||!ready){ pendingPhone=phone; return; }
      pendingPhone=null;
      document.getElementById('status').textContent='Sending OTP…';
      auth.signInWithPhoneNumber(phone, verifier)
        .then(function(result){
          post({type:'verificationId', verificationId:result.verificationId});
        })
        .catch(function(e){
          initVerifier();
          var msg=e.message||'Failed to send OTP';
          if(e.code==='auth/too-many-requests') msg='Too many attempts. Try again later.';
          if(e.code==='auth/invalid-phone-number') msg='Invalid phone number.';
          post({type:'error', error:msg, code:e.code||''});
        });
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
    function handleMessage(event){
      try{
        var data=JSON.parse(event.data);
        if(data.action==='sendOtp') sendOtp(data.phone);
      }catch(e){}
    }

    initVerifier();
  <\/script>
</body>
</html>
`;

const PhoneAuthWebView = forwardRef<PhoneAuthHandle>((_, ref) => {
  const webViewRef = useRef<WebView>(null);
  const [visible, setVisible] = useState(false);
  const pendingRef = useRef<{
    resolve: (id: string) => void;
    reject: (err: Error) => void;
  } | null>(null);
  const phoneRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (failsafeRef.current) { clearTimeout(failsafeRef.current); failsafeRef.current = null; }
  }, []);

  // Inject sendOtp call into the WebView
  const injectSendOtp = useCallback((phone: string) => {
    webViewRef.current?.injectJavaScript(`
      sendOtp('${phone.replace(/'/g, "\\'")}');
      true;
    `);
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'ready':
          readyRef.current = true;
          // WebView + reCAPTCHA ready — now send the OTP request
          if (phoneRef.current && pendingRef.current) {
            injectSendOtp(phoneRef.current);
          }
          break;
        case 'verificationId':
          cleanup();
          setVisible(false);
          pendingRef.current?.resolve(data.verificationId);
          pendingRef.current = null;
          phoneRef.current = null;
          break;
        case 'error':
          cleanup();
          setVisible(false);
          pendingRef.current?.reject(new Error(data.error));
          pendingRef.current = null;
          phoneRef.current = null;
          break;
        case 'recaptcha-expired':
          break;
      }
    } catch {}
  }, [cleanup, injectSendOtp]);

  useImperativeHandle(ref, () => ({
    sendOtp: (phoneNumber: string) => {
      return new Promise<string>((resolve, reject) => {
        cleanup();
        pendingRef.current = { resolve, reject };
        phoneRef.current = phoneNumber;
        readyRef.current = false;
        setVisible(true);

        // Retry injection every 3s in case 'ready' message was missed
        timeoutRef.current = setTimeout(function retry() {
          if (pendingRef.current && phoneRef.current) {
            injectSendOtp(phoneRef.current);
            timeoutRef.current = setTimeout(retry, 3000);
          }
        }, 4000);

        // Failsafe: reject after 30s if no response
        failsafeRef.current = setTimeout(() => {
          if (pendingRef.current) {
            cleanup();
            setVisible(false);
            pendingRef.current.reject(new Error('Verification timed out. Please try again.'));
            pendingRef.current = null;
            phoneRef.current = null;
          }
        }, 30000);
      });
    },
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={styles.text}>Verifying…</Text>
        </View>
        <WebView
          ref={webViewRef}
          source={{ html: HTML, baseUrl: `https://${AUTH_DOMAIN}` }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          style={styles.webview}
          originWhitelist={['*']}
          onError={() => {
            setVisible(false);
            pendingRef.current?.reject(new Error('WebView failed to load'));
            pendingRef.current = null;
          }}
        />
      </View>
    </Modal>
  );
});

PhoneAuthWebView.displayName = 'PhoneAuthWebView';
export default PhoneAuthWebView;

const styles = StyleSheet.create({
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
  webview: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
  },
});
