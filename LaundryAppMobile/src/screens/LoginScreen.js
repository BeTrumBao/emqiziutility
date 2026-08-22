import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { Text, TextInput, Button, Surface, Snackbar } from 'react-native-paper';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setSnackbarMessage('Vui lòng nhập đầy đủ email và mật khẩu!');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // App.js onAuthStateChanged will handle navigation
    } catch (error) {
      let errorMsg = 'Đăng nhập thất bại: ' + error.message;
      if (error.code === 'auth/invalid-email') errorMsg = 'Email không hợp lệ!';
      else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') errorMsg = 'Tài khoản hoặc mật khẩu không chính xác!';
      else if (error.code === 'auth/too-many-requests') errorMsg = 'Thử quá nhiều lần, vui lòng chờ một lát!';
      else if (error.code === 'auth/network-request-failed') errorMsg = 'Lỗi mạng, vui lòng kiểm tra lại kết nối!';
      
      setSnackbarMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
        <Image source={require('../../assets/banner.jpg')} style={{ width: '100%', height: '55%', resizeMode: 'cover', opacity: 0.8 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Surface style={styles.contentCard} elevation={0}>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 32 }}>
            <View style={styles.dragHandle} />
            <View style={styles.header}>
              <Text variant="headlineMedium" style={styles.title}>Đăng Nhập</Text>
              <Text variant="bodyMedium" style={styles.subtitle}>Chào mừng bạn quay lại!</Text>
            </View>

            <TextInput
              label="Email"
              mode="outlined"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              outlineColor="#E8EAED"
              activeOutlineColor="#1A73E8"
              left={<TextInput.Icon icon="email" color="#5F6368" />}
            />

            <TextInput
              label="Mật khẩu"
              mode="outlined"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              outlineStyle={styles.inputOutline}
              outlineColor="#E8EAED"
              activeOutlineColor="#1A73E8"
              left={<TextInput.Icon icon="lock" color="#5F6368" />}
            />

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.loginBtn}
              labelStyle={styles.loginBtnLabel}
              contentStyle={{ paddingVertical: 10 }}
            >
              Đăng Nhập
            </Button>

            <View style={styles.registerContainer}>
              <Text variant="bodyMedium" style={{ color: '#5F6368' }}>Chưa có tài khoản?</Text>
              <Button
                mode="text"
                onPress={() => navigation.navigate('Register')}
              >
                Đăng ký ngay
              </Button>
            </View>
          </ScrollView>
        </Surface>
      </KeyboardAvoidingView>

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage('')}
        duration={3000}
        style={{ backgroundColor: '#202124', borderRadius: 8 }}
        action={{
          label: 'Đóng',
          textColor: '#1A73E8',
          onPress: () => setSnackbarMessage(''),
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 14 }}>{snackbarMessage}</Text>
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
  },
  dragHandle: {
    width: 48,
    height: 6,
    backgroundColor: '#E8EAED',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontWeight: '900',
    color: '#1A73E8',
    marginBottom: 8,
    fontSize: 28,
  },
  subtitle: {
    color: '#5F6368',
    textAlign: 'center',
    fontSize: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  inputOutline: {
    borderRadius: 16,
    borderWidth: 1.5,
  },
  loginBtn: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#1A73E8',
  },
  loginBtnLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  }
});

export default LoginScreen;
