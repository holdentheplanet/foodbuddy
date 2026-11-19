import Disclosure from '../components/Disclosure';
import AccountTools from '../components/AccountTools';

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
          accessibilityRole="button" accessibilityLabel="Change profile picture" accessibilityState={{ disabled: saving, busy: saving }}
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
          accessibilityRole="button" accessibilityLabel="Change profile picture" accessibilityState={{ disabled: saving, busy: saving }}
          onPress={changeProfilePicture}
          disabled={saving}
          style={styles.photoAction}
        >
          <Text style={styles.changePhoto}>
            {saving ? 'Saving...' : 'Change Profile Picture'}
          </Text>
        </TouchableOpacity>

        {saving && <ActivityIndicator color="#183D32" />}

        <Text style={styles.username}>{user.username}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <Disclosure title="About FoodBuddy & Food Safety">
        <Text style={styles.safetyText}>FoodBuddy compares available product labels with your saved allergies. These checks are preliminary and may miss allergens or cross-contact. No result guarantees a product is safe or allergy-free.</Text>
        <Text style={styles.safetyText}>Manufacturers can change ingredients. Always check the physical packaging and current allergen warnings before consuming. Verified ingredient text does not mean allergen declarations or precautionary statements are complete. Unknown information never confirms an allergen is absent.</Text>
        <Text style={styles.safetyText}>Product search works offline. Photo credits and verification sources are available in each product’s details. Store inventory is demonstration data, simulated rather than live availability.</Text>
      </Disclosure>

      <Disclosure title="Cloud sync & legacy account tools"><AccountTools key={user.supabaseId} user={user} /></Disclosure>

      {/* ACCOUNT & SECURITY */}
      <View style={styles.securityCard}>
        <Text style={styles.securityTitle}>Account & Security</Text>

        <TouchableOpacity
          style={styles.settingRow}
          accessibilityRole="button" accessibilityLabel="Change password" accessibilityState={{ expanded: showPasswordForm }}
          onPress={() => setShowPasswordForm(!showPasswordForm)}
        >
          <Text style={styles.settingText}>Change Password</Text>
          <Text style={styles.settingArrow}>
            {showPasswordForm ? '⌃' : '›'}
          </Text>
        </TouchableOpacity>

        {showPasswordForm && (
          <View style={styles.passwordForm}>
            <TextInput
              style={styles.passwordInput}
              accessibilityLabel="Current password"
              placeholderTextColor="#53645F"
              placeholder="Current Password"
              secureTextEntry
              autoCapitalize="none"
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <TextInput
              style={styles.passwordInput}
              accessibilityLabel="New password"
              placeholderTextColor="#53645F"
              placeholder="New Password"
              secureTextEntry
              autoCapitalize="none"
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TextInput
              style={styles.passwordInput}
              accessibilityLabel="Confirm new password"
              placeholderTextColor="#53645F"
              placeholder="Confirm New Password"
              secureTextEntry
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              style={styles.savePasswordButton}
              accessibilityRole="button" accessibilityLabel="Update password" accessibilityState={{ disabled: passwordSaving, busy: passwordSaving }}
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
        accessibilityRole="button" accessibilityLabel="Log out"
        onPress={onLogout}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safetyText: { color: '#53645F', fontSize: 14, lineHeight: 22 },
  container: {
    flex: 1,
    backgroundColor: '#F7F5EF',
    padding: 24,
    paddingTop: 12,
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#172B4D',
    marginBottom: 25,
  },

  profileCard: {
    backgroundColor: 'transparent',
    paddingVertical: 24,
    alignItems: 'center',
  },

  photoAction: { minHeight: 44, justifyContent: 'center' },
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
    backgroundColor: 'transparent',
    paddingVertical: 20,
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