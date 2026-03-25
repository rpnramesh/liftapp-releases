// ─────────────────────────────────────────────────────────────────────────────
// Lift Member App — Phone Auth via WebView (production reCAPTCHA)
// Uses Firebase web SDK inside a WebView for real reCAPTCHA verification.
// Returns verificationId to RN for OTP confirmation via signInWithCredential.
// ─────────────────────────────────────────────────────────────────────────────

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const PRIMARY = '#1A56DB';

const FIREBASE_CONFIG = JSON.stringify({
  apiKey: 'AIzaSyBWfe4NVioDMI1b_VuZvkBsNCMJLnWI32M',
  authDomain: 'lift-bfd12.firebaseapp.com',
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
    body { margin:0; display:flex; align-items:center; justify-content:center;
           min-height:100vh; font-family:sans-serif; background:#fff; }
    #status { color:#6B7280; font-size:14px; text-align:center; padding:20px; }
  </style>
</head>
<body>
  <div id="recaptcha-container"></div>
  <div id="status">Verifying…</div>

  <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
  <script>
    var app = firebase.initializeApp(${FIREBASE_CONFIG});
    var auth = firebase.auth();
    var verifier = null;
    var ready = false;

    function post(obj) {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }

    function initVerifier() {
      if (verifier) { verifier.clear(); verifier = null; }
      verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: function() { post({ type: 'recaptcha-solved' }); },
        'expired-callback': function() { post({ type: 'recaptcha-expired' }); }
      });
      verifier.render().then(function() {
        ready = true;
        post({ type: 'ready' });
      }).catch(function(e) {
        post({ type: 'error', error: 'reCAPTCHA render failed: ' + e.message });
      });
    }

    initVerifier();

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    function handleMessage(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.action === 'sendOtp') {
          document.getElementById('status').textContent = 'Sending OTP…';
          if (!verifier || !ready) {
            post({ type: 'error', error: 'reCAPTCHA not ready. Please try again.' });
            return;
          }
          auth.signInWithPhoneNumber(data.phone, verifier)
            .then(function(result) {
              post({ type: 'verificationId', verificationId: result.verificationId });
            })
            .catch(function(e) {
              initVerifier();
              var msg = e.message || 'Failed to send OTP';
              if (e.code === 'auth/too-many-requests') msg = 'Too many attempts. Please try again later.';
              if (e.code === 'auth/invalid-phone-number') msg = 'Invalid phone number format.';
              post({ type: 'error', error: msg, code: e.code || '' });
            });
        }
      } catch(e) {}
    }
  </script>
</body>
</html>
`;

const PhoneAuthWebView = forwardRef((_, ref) => {
  const webViewRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const pendingRef = useRef(null);
  const readyRef = useRef(false);

  const onMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'ready':
          readyRef.current = true;
          break;
        case 'verificationId':
          setVisible(false);
          pendingRef.current?.resolve(data.verificationId);
          pendingRef.current = null;
          break;
        case 'error':
          setVisible(false);
          pendingRef.current?.reject(new Error(data.error));
          pendingRef.current = null;
          break;
      }
    } catch {}
  }, []);

  useImperativeHandle(ref, () => ({
    sendOtp: (phoneNumber) => {
      return new Promise((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        setVisible(true);
        const trySend = () => {
          webViewRef.current?.injectJavaScript(`
            handleMessage({ data: '${JSON.stringify({ action: 'sendOtp', phone: phoneNumber }).replace(/'/g, "\\'")}' });
            true;
          `);
        };
        if (readyRef.current) {
          setTimeout(trySend, 300);
        } else {
          setTimeout(trySend, 2000);
        }
      });
    },
  }));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator color={PRIMARY} size="large" />
          <Text style={styles.text}>Verifying…</Text>
        </View>
        <WebView
          ref={webViewRef}
          source={{ html: HTML }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          style={styles.webview}
          originWhitelist={['*']}
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
  card: { alignItems: 'center', gap: 16, padding: 32, zIndex: 10 },
  text: { fontSize: 15, color: '#6B7280', fontWeight: '500' },
  webview: { position: 'absolute', width: 1, height: 1, opacity: 0.01 },
});
