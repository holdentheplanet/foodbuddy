
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

import { User, updateProfilePicture, changePassword } from '../database/auth';

type Props = {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
};

export default function SettingsScreen({
  user,
  onUserUpdated,
  onLogout,
}: Props) {
  const [saving, setSaving] = useState(false);
const [showPasswordForm, setShowPasswordForm] = useState(false);
const [currentPassword, setCurrentPassword] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [passwordSaving, setPasswordSaving] = useState(false);

async function handleChangePassword() {
  if (passwordSaving) return;

  if (!currentPassword || !newPassword || !confirmPassword) {
    Alert.alert('Missing Information', 'Please fill in all password fields.');
    return;
  }

  if (newPassword !== confirmPassword) {
    Alert.alert('Passwords Do Not Match', 'Please confirm your new password.');
    return;
  }

  setPasswordSaving(true);

  try {
    await changePassword(user.id, currentPassword, newPassword);

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordForm(false);

    Alert.alert('Success', 'Your password has been updated!');
  } catch (error) {
    Alert.alert(
      'Unable to Change Password',
      error instanceof Error ? error.message : 'Please try again.'
    );
  } finally {
    setPasswordSaving(false);
  }
}
  async function changeProfilePicture() {
    if (saving) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission Needed',
          'Please allow access to your photos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      setSaving(true);

      const source = new File(result.assets[0].uri);
      const folder = new Directory(Paths.document, 'profile-pictures');

      folder.create({ idempotent: true, intermediates: true });

      const extension =
        result.assets[0].mimeType === 'image/png' ? 'png' : 'jpg';

      const destination = new File(
        folder,
        `user-${user.id}-${Date.now()}.${extension}`
      );

      source.copy(destination);

      const updatedUser = await updateProfilePicture(
        user.id,
        destination.uri
      );

      onUserUpdated(updatedUser);
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error) {
      console.error('Profile picture error:', error);
      Alert.alert('Error', 'Could not update your profile picture.');
    } finally {
      setSaving(false);
    }
  }

      return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Settings</Text>

      {/* PROFILE CARD */}
      <View style={styles.profileCard}>
        <TouchableOpacity
          onPress={changeProfilePicture}
          disabled={saving}
          style={styles.avatarButton}
        >
          {user.profile_picture ? (
            <Image
              source={{ uri: user.profile_picture }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.placeholderAvatar}>
              <Text style={styles.avatarInitial}>
                {user.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={changeProfilePicture}
          disabled={saving}
        >
          <Text style={styles.changePhoto}>
            {saving ? 'Saving...' : 'Change Profile Picture'}
          </Text>
        </TouchableOpacity>

        {saving && <ActivityIndicator color="#183D32" />}

        <Text style={styles.username}>{user.username}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      {/* ACCOUNT & SECURITY */}
      <View style={styles.securityCard}>
        <Text style={styles.securityTitle}>Account & Security</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowPasswordForm(!showPasswordForm)}
        >
          <Text style={styles.settingText}>🔒 Change Password</Text>
          <Text style={styles.settingArrow}>
            {showPasswordForm ? '⌃' : '›'}
          </Text>
        </TouchableOpacity>

        {showPasswordForm && (
          <View style={styles.passwordForm}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Current Password"
              secureTextEntry
              autoCapitalize="none"
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <TextInput
              style={styles.passwordInput}
              placeholder="New Password"
              secureTextEntry
              autoCapitalize="none"
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm New Password"
              secureTextEntry
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              style={styles.savePasswordButton}
              onPress={handleChangePassword}
              disabled={passwordSaving}
            >
              <Text style={styles.savePasswordText}>
                {passwordSaving ? 'Updating...' : 'Update Password'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* LOG OUT */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={onLogout}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5EF',
    padding: 24,
    paddingTop: 35,
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#172B4D',
    marginBottom: 25,
  },

  profileCard: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 18,
    alignItems: 'center',
  },

  avatarButton: {
    marginBottom: 12,
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },

  placeholderAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#183D32',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarInitial: {
    color: 'white',
    fontSize: 44,
    fontWeight: 'bold',
  },

  changePhoto: {
    color: '#183D32',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 15,
  },

  username: {
    color: '#172B4D',
    fontSize: 22,
    fontWeight: 'bold',
  },

  email: {
    color: '#666',
    marginTop: 5,
  },

  securityCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 20,
    marginTop: 20,
  },

  securityTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#172B4D',
    marginBottom: 12,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },

  settingText: {
    fontSize: 16,
    color: '#183D32',
    fontWeight: '600',
  },

  settingArrow: {
    fontSize: 24,
    color: '#666',
  },

  passwordForm: {
    marginTop: 12,
  },

  passwordInput: {
    backgroundColor: '#F7F5EF',
    borderWidth: 1,
    borderColor: '#E6E8E4',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
    color: '#172B4D',
  },

  savePasswordButton: {
    backgroundColor: '#183D32',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 5,
  },

  savePasswordText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  logoutButton: {
    backgroundColor: '#172B4D',
    borderRadius: 12,
    padding: 17,
    marginTop: 25,
    alignItems: 'center',
  },

  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});