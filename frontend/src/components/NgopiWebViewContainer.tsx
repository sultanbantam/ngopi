import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Platform,
  Linking,
  StatusBar,
  Image,
  PermissionsAndroid,
  Share,
  Vibration,
  Keyboard,
  Alert,
  NativeModules,
} from 'react-native';
import { WebView, WebViewNavigation, WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';

const WEB_APP_URL = 'https://ngopi.top';

const INJECTED_BRIDGE_JS = `
(function() {
  function postToNative(payload) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Notify native container as soon as DOM is interactive so loading overlay never hangs
  function notifyReady() {
    postToNative({ type: 'WEB_READY' });
  }
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    notifyReady();
  } else {
    document.addEventListener('DOMContentLoaded', notifyReady, { once: true });
    window.addEventListener('load', notifyReady, { once: true });
  }
  setTimeout(notifyReady, 1200);

  if (window.__ngopiNativeBridgeInstalled) return;
  window.__ngopiNativeBridgeInstalled = true;

  // 0. Bridge ceKKes Native Android Module (IMU, UsageStats, Android TTS)
  try {
    var pendingCekkes = {};
    var cekkesSeq = 1;
    window.__ngopiCekkesNativeAvailable = ${Boolean(Platform.OS === 'android')};
    window.__ngopiCekkesResolve = function(id, res, err) {
      var cb = pendingCekkes[id];
      if (!cb) return;
      delete pendingCekkes[id];
      if (err) cb.reject(new Error(err));
      else cb.resolve(res);
    };
    window.__ngopiCekkesCall = function(method, args) {
      return new Promise(function(resolve, reject) {
        var id = 'ck_' + (cekkesSeq++);
        pendingCekkes[id] = { resolve: resolve, reject: reject };
        if (!postToNative({ type: 'CEKKES_NATIVE_CALL', id: id, method: method, args: args || [] })) {
          delete pendingCekkes[id];
          reject(new Error('Native bridge unavailable'));
        }
      });
    };
  } catch (e) {}

  // 1. Bridge navigator.clipboard.writeText
  try {
    if (!navigator.clipboard) {
      navigator.clipboard = {};
    }
    const origWriteText = navigator.clipboard.writeText
      ? navigator.clipboard.writeText.bind(navigator.clipboard)
      : null;
    navigator.clipboard.writeText = function(text) {
      postToNative({ type: 'COPY_CLIPBOARD', text: String(text || '') });
      if (origWriteText) {
        return origWriteText(text).catch(function() { return Promise.resolve(); });
      }
      return Promise.resolve();
    };
  } catch (e) {}

  // 2. Bridge navigator.share
  try {
    navigator.share = function(data) {
      if (postToNative({
        type: 'NATIVE_SHARE',
        title: data && data.title ? String(data.title) : '',
        text: data && data.text ? String(data.text) : '',
        url: data && data.url ? String(data.url) : ''
      })) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('Share not supported'));
    };
    navigator.canShare = function() { return true; };
  } catch (e) {}

  // 3. Bridge navigator.vibrate
  try {
    navigator.vibrate = function(pattern) {
      postToNative({ type: 'VIBRATE', pattern: pattern });
      return true;
    };
  } catch (e) {}

  // 4. Bridge window.open for external links and file downloads
  try {
    const origOpen = window.open ? window.open.bind(window) : null;
    window.open = function(url, target, features) {
      if (url && typeof url === 'string') {
        const resolved = new URL(url, window.location.origin).href;
        const isInternalPage =
          resolved.startsWith('https://ngopi.top') &&
          !resolved.includes('/uploads/');
        if (!isInternalPage) {
          postToNative({ type: 'OPEN_EXTERNAL_URL', url: resolved });
          return null;
        }
        window.location.href = resolved;
        return window;
      }
      return origOpen ? origOpen(url, target, features) : null;
    };
  } catch (e) {}

  // 5. Intercept <a download> clicks for attachments
  document.addEventListener('click', function(e) {
    try {
      let el = e.target;
      while (el && el.tagName !== 'A') {
        el = el.parentElement;
      }
      if (!el || !el.href) return;
      const href = el.href;
      const hasDownload = el.hasAttribute('download');
      if (
        hasDownload &&
        (href.startsWith('http://') || href.startsWith('https://')) &&
        !href.startsWith('blob:')
      ) {
        e.preventDefault();
        postToNative({ type: 'OPEN_EXTERNAL_URL', url: href });
      }
    } catch (err) {}
  }, true);
})();
true;
`;

export default function NgopiWebViewContainer() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const hasLoadedOnceRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(WEB_APP_URL);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const dismissLoading = useCallback(() => {
    hasLoadedOnceRef.current = true;
    setIsLoading(false);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Hide native splash screen & ensure loading overlay never hangs forever
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => {
      dismissLoading();
    }, 2500);
    return () => clearTimeout(timer);
  }, [dismissLoading]);

  // Request Android runtime permissions for Camera, Microphone, and Location
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const requestPermissions = async () => {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
      } catch (err) {
        console.warn('Permission request warning:', err);
      }
    };
    requestPermissions();
  }, []);

  // Handle Android keyboard height so chat inputs at the bottom are never covered
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Handle deep linking (e.g. ngopi://contacts?join=BoomBoom or https://ngopi.top/contacts?join=BoomBoom)
  useEffect(() => {
    const handleUrl = (eventUrl: string | null) => {
      if (!eventUrl) return;
      try {
        if (eventUrl.startsWith('ngopi://')) {
          const pathAndQuery = eventUrl.replace('ngopi://', '');
          const target = `${WEB_APP_URL}/${pathAndQuery.replace(/^\//, '')}`;
          setCurrentUrl(target);
          webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(target)}; true;`);
        } else if (eventUrl.includes('ngopi.top')) {
          setCurrentUrl(eventUrl);
          webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(eventUrl)}; true;`);
        }
      } catch (err) {
        console.warn('Deep link parsing error:', err);
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  // Handle Android hardware back button
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [canGoBack]);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    if (!navState.loading) {
      dismissLoading();
      if (isError) {
        setIsError(false);
      }
    }
  }, [isError, dismissLoading]);

  const handleShouldStartLoadWithRequest = useCallback((request: any) => {
    const url: string = request?.url || '';
    if (!url) return false;

    // Allow internal web schemes
    if (url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) {
      return true;
    }

    // Handle custom deep link scheme ngopi:// inside WebView
    if (url.startsWith('ngopi://')) {
      const pathAndQuery = url.replace('ngopi://', '');
      const target = `${WEB_APP_URL}/${pathAndQuery.replace(/^\//, '')}`;
      webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(target)}; true;`);
      return false;
    }

    // Handle external schemes (tel:, mailto:, whatsapp:, intent:, geo:, maps:)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Linking.openURL(url).catch(() => {});
      return false;
    }

    // Open external domains (WhatsApp, Google Maps, direct file downloads) in native browser/apps
    const isNgopiDomain =
      url.startsWith('https://ngopi.top') ||
      url.startsWith('http://ngopi.top') ||
      url.startsWith('https://www.ngopi.top');

    if (!isNgopiDomain) {
      Linking.openURL(url).catch(() => {});
      return false;
    }

    return true;
  }, []);

  const handleWebViewMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (!data || typeof data !== 'object') return;

      if (data.type === 'WEB_READY') {
        dismissLoading();
      } else if (data.type === 'COPY_CLIPBOARD' && typeof data.text === 'string') {
        await Clipboard.setStringAsync(data.text);
      } else if (data.type === 'NATIVE_SHARE') {
        const parts = [data.text, data.url].filter(Boolean);
        const message = parts.join('\n');
        await Share.share({
          title: data.title || 'Ngopi',
          message: message || data.title || WEB_APP_URL,
          url: data.url || undefined,
        });
      } else if (data.type === 'VIBRATE') {
        const pattern = data.pattern;
        if (!pattern || pattern === 0 || (Array.isArray(pattern) && pattern.length === 0)) {
          Vibration.cancel();
        } else if (Array.isArray(pattern)) {
          Vibration.vibrate(pattern);
        } else if (typeof pattern === 'number') {
          Vibration.vibrate(pattern);
        }
      } else if (data.type === 'OPEN_EXTERNAL_URL' && typeof data.url === 'string') {
        Linking.openURL(data.url).catch(() => {
          Alert.alert('Info', 'Tidak dapat membuka tautan ini.');
        });
      } else if (data.type === 'CEKKES_NATIVE_CALL' && data.id && data.method) {
        const mod = NativeModules?.CekkesBackgroundModule;
        const fn = mod && typeof mod[data.method] === 'function' ? mod[data.method] : null;
        if (!fn) {
          webViewRef.current?.injectJavaScript(
            `window.__ngopiCekkesResolve && window.__ngopiCekkesResolve(${JSON.stringify(data.id)}, null, "CekkesBackgroundModule unavailable"); true;`
          );
          return;
        }
        try {
          const result = await fn(...(Array.isArray(data.args) ? data.args : []));
          webViewRef.current?.injectJavaScript(
            `window.__ngopiCekkesResolve && window.__ngopiCekkesResolve(${JSON.stringify(data.id)}, ${JSON.stringify(result)}, null); true;`
          );
        } catch (err: any) {
          webViewRef.current?.injectJavaScript(
            `window.__ngopiCekkesResolve && window.__ngopiCekkesResolve(${JSON.stringify(data.id)}, null, ${JSON.stringify(err?.message || 'Native call failed')}); true;`
          );
        }
      }
    } catch {
      // Ignore non-JSON messages from third-party scripts
    }
  }, [dismissLoading]);

  const handleRetry = () => {
    setIsError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
    setTimeout(() => dismissLoading(), 2500);
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === 'ios' ? insets.top : 0,
          paddingBottom: Math.max(insets.bottom, keyboardHeight),
        },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor="#171411" translucent={false} />

      {/* Main WebView Container */}
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webView}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically
        domStorageEnabled
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        androidLayerType="hardware"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        setSupportMultipleWindows={false}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        geolocationEnabled
        allowsFullscreenVideo
        pullToRefreshEnabled={false}
        allowsBackForwardNavigationGestures
        mixedContentMode="always"
        originWhitelist={['*']}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        injectedJavaScriptBeforeContentLoaded={INJECTED_BRIDGE_JS}
        injectedJavaScript={INJECTED_BRIDGE_JS}
        onMessage={handleWebViewMessage}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onFileDownload={({ nativeEvent: { downloadUrl } }) => {
          if (downloadUrl) {
            Linking.openURL(downloadUrl).catch(() => {});
          }
        }}
        onLoadProgress={({ nativeEvent }) => {
          if (nativeEvent.progress >= 0.45) {
            dismissLoading();
          }
        }}
        onLoadEnd={() => dismissLoading()}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          dismissLoading();
          if (nativeEvent.url && nativeEvent.url.startsWith(WEB_APP_URL) && !hasLoadedOnceRef.current) {
            setIsError(true);
          }
        }}
        applicationNameForUserAgent="NgopiApp/1.0.6"
      />

      {/* Warm Splash / Loading Overlay for initial boot only */}
      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>Ngopi</Text>
          <Text style={styles.brandSubtitle}>Warung Kopi & Komunitas Digital</Text>
          <ActivityIndicator size="large" color={coffee.accent} style={{ marginTop: 24 }} />
        </View>
      )}

      {/* Offline / Error Screen */}
      {isError && (
        <View style={styles.errorOverlay}>
          <Ionicons name="cloud-offline-outline" size={64} color={coffee.warning} />
          <Text style={styles.errorTitle}>Koneksi Terputus</Text>
          <Text style={styles.errorDesc}>
            Gagal menghubungkan ke server Ngopi. Pastikan koneksi internet ponsel Anda aktif.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.85}>
            <Ionicons name="refresh" size={18} color={coffee.buttonText} />
            <Text style={styles.retryBtnText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171411',
  },
  webView: {
    flex: 1,
    backgroundColor: '#171411',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#171411',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: coffee.text,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: coffee.secondary,
    marginTop: 6,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#171411',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    zIndex: 100,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: coffee.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorDesc: {
    fontSize: 14,
    color: coffee.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: coffee.button,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  retryBtnText: {
    color: coffee.buttonText,
    fontSize: 15,
    fontWeight: '700',
  },
});
