import { coffee } from '../../src/theme/coffee';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform, Modal, TextInput, Alert, Image, ScrollView, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { socketService } from '../../src/utils/socket';
import * as SecureStore from '../../src/utils/storage';
import { clearStoredSession, getStoredRefreshToken } from '../../src/utils/session';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import axios from 'axios';
import { getAuthHeaders } from '../../src/utils/api';
import { uploadProfileAvatar, profileSaveError } from '../../src/utils/profileUpload';
import { profileSlug } from '../../src/utils/profileLink';
import { EmptyState } from '../../src/components/EmptyState';
import { useNightMode } from '../../src/theme/nightMode';

const API_URL = 'https://api.ngopi.top/api';

export default function ContactsScreen() {
  const { openMenu, createWarkop, editWarkop } = useLocalSearchParams<{ openMenu?: string; createWarkop?: string; editWarkop?: string }>();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentBmcId, setCurrentBmcId] = useState('');
  const [currentRole, setCurrentRole] = useState('user');
  const [currentUserId, setCurrentUserId] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const [activeTab, setActiveTab] = useState<'semua' | 'belum_dibaca' | 'favorit' | 'warkop'>('semua');
  const { setting: nightSetting, isNightActive, changeSetting: setNightSetting } = useNightMode();

  // Modals state
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const [isGroupModalVisible, setGroupModalVisible] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupMinBmc, setGroupMinBmc] = useState('0');
  const [groupAvatar, setGroupAvatar] = useState('');
  const [groupJoinPolicy, setGroupJoinPolicy] = useState<'open' | 'approval'>('open');
  const [groupOnlyAdminsCanSend, setGroupOnlyAdminsCanSend] = useState(false);
  const [groupAllowMemberInvites, setGroupAllowMemberInvites] = useState(true);
  const [groupCallEnabled, setGroupCallEnabled] = useState(true);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);


  // Settings Modal
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
  const [settings, setSettings] = useState<any>({ hide_name: false, hide_contacts: false, hide_groups: false, preferred_language: 'id' });

  // Profile Modal State
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [pickedAvatar, setPickedAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const profileLink = `https://ngopi.top/${encodeURIComponent(profileSlug(currentUser || currentUsername))}`;

  // Online Users State
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  useEffect(() => {
    if (openMenu === '1') setDropdownVisible(true);
  }, [openMenu]);

  useEffect(() => {
    const init = async () => {
      await socketService.connect();

      let user = '';
      let userId = '';
      let token = '';
      let inviteCode = '';
      if (Platform.OS === 'web') {
        const urlParams = new URLSearchParams(window.location.search);
        inviteCode = urlParams.get('join') || '';
        const ssoToken = urlParams.get('sso_token');
        const ssoUsername = urlParams.get('sso_username');
        const ssoUserId = urlParams.get('sso_userid');

        if (ssoToken && ssoUsername && ssoUserId) {
          localStorage.setItem('token', ssoToken);
          localStorage.setItem('username', ssoUsername);
          localStorage.setItem('userId', ssoUserId);
          window.history.replaceState({}, document.title, window.location.pathname);
          token = ssoToken;
          user = ssoUsername;
          userId = ssoUserId;
        } else {
          user = localStorage.getItem('username') || '';
          userId = localStorage.getItem('userId') || '';
          token = localStorage.getItem('token') || '';
        }
      } else {
        user = (await SecureStore.getItemAsync('username')) || '';
        userId = (await SecureStore.getItemAsync('userId')) || '';
        token = (await SecureStore.getItemAsync('token')) || '';
      }
      setCurrentUser(user);
      setCurrentUsername(user);
      setCurrentUserId(userId);

      // Fetch users and groups
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [usersRes, groupsRes, settingsRes, unreadRes] = await Promise.all([
          axios.get(`${API_URL}/auth/users`, { headers }),
          axios.get(`${API_URL}/groups`, { headers }),
          axios.get(`${API_URL}/settings`, { headers }).catch(() => ({ data: {} })),
          axios.get(`${API_URL}/messages/unread/counts`, { headers }).catch(() => ({ data: {} }))
        ]);

        const allUsers = usersRes.data;
        setContacts(allUsers.filter((u: any) => u.id !== userId));
        setGroups(groupsRes.data);
        if (settingsRes.data) setSettings(settingsRes.data);
        if (unreadRes.data) setUnreadCounts(unreadRes.data);

        if (inviteCode && token) {
          const joinRes = await axios.post(`${API_URL}/groups/invite/${inviteCode}/join`, {}, { headers });
          if (joinRes.status === 202 || joinRes.data?.pendingApproval) {
            if (Platform.OS === 'web') alert('Permintaan join warkop sudah dikirim dan menunggu persetujuan admin.');
            else Alert.alert('Menunggu Admin', 'Permintaan join warkop sudah dikirim dan menunggu persetujuan admin.');
          } else if (Platform.OS === 'web') {
            alert('Berhasil join warkop dari link undangan.');
          } else {
            Alert.alert('Berhasil', 'Berhasil join warkop dari link undangan.');
          }
          const refreshedGroups = await axios.get(`${API_URL}/groups`, { headers });
          setGroups(refreshedGroups.data);
          if (Platform.OS === 'web') window.history.replaceState({}, document.title, window.location.pathname);
        }

        const me = allUsers.find((u: any) => u.id === userId);
        if (me) {
          setCurrentUser(me.display_name);
          setCurrentUsername(me.username);
          setCurrentBmcId(me.bmc_id?.toString() || '');
          setCurrentRole(me.role || 'user');
          setEditDisplayName(me.display_name);
          setEditBio(me.bio || '');
          setEditStatus(me.status || '');
          setEditAvatar(me.avatar_url || '');
          setCurrentAvatarUrl(me.avatar_url || '');
        }
      } catch (e) {
        console.error('Failed to fetch data', e);
      }

      if (socketService.socket) {
        socketService.socket.on('receive_message', (data: any) => {
          setUnreadCounts(prev => ({
            ...prev,
            [data.room_id || data.sender_id]: (prev[data.room_id || data.sender_id] || 0) + 1
          }));

          // Trigger Web Notification jika tab sedang disembunyikan
          if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
             new Notification('Ngopi: Pesan Baru', {
               body: 'Anda menerima pesan baru dari kontak Anda.',
               icon: '/favicon.ico'
             });
          }
        });

        socketService.socket.on('online_list', (data: any[]) => {
          setOnlineUsers(data.filter(u => u.id !== userId));
        });

        socketService.socket.emit('request_online_list');
      }

      setLoading(false);
    };

    init();

    return () => {
      if (socketService.socket) {
        socketService.socket.off('receive_message');
        socketService.socket.off('online_list');
      }
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && 'Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  const openChat = (id: string, name: string, type?: 'group' | 'contact') => {
    setUnreadCounts(prev => ({ ...prev, [id]: 0 }));
    router.push({ pathname: '/(main)/chat/[id]', params: { id, name, ...(type === 'group' ? { type: 'group' } : {}) } });
  };

  const openCreateGroupModal = () => {
    setEditingGroupId(null);
    setSelectedMembers([]);
    setMemberSearch('');
    setGroupName('');
    setGroupDescription('');
    setGroupMinBmc('0');
    setGroupAvatar('');
    setGroupJoinPolicy('open');
    setGroupOnlyAdminsCanSend(false);
    setGroupAllowMemberInvites(true);
    setGroupCallEnabled(true);
    setGroupModalVisible(true);
  };

  useEffect(() => {
    if (createWarkop === '1') {
      openCreateGroupModal();
      setActiveTab('warkop');
      router.setParams({ createWarkop: '' });
    }
  }, [createWarkop]);

  const openEditGroupModal = (group: any) => {
    setEditingGroupId(group.id);
    setGroupName(group.name || '');
    setGroupDescription(group.description || '');
    setGroupMinBmc(String(group.min_bmc_balance ?? 0));
    setGroupAvatar(group.avatar_url || '');
    setGroupJoinPolicy(group.join_policy === 'approval' ? 'approval' : 'open');
    setGroupOnlyAdminsCanSend(!!group.only_admins_can_send);
    setGroupAllowMemberInvites(group.allow_member_invites !== false);
    setGroupCallEnabled(group.call_enabled !== false);
    setGroupModalVisible(true);
  };
  useEffect(() => {
    const group = groups.find(item => item.id === editWarkop);
    if (group) { openEditGroupModal(group); router.setParams({ editWarkop: '' }); }
  }, [editWarkop, groups]);

  const openHelpCenter = () => {
    router.push('/(main)/help-center' as any);
  };

  const openAdminDashboard = () => {
    router.push('/(main)/admin/dashboard' as any);
  };

  const handleLogout = async () => {
    try {
      const refreshToken = await getStoredRefreshToken();
      await axios.post(
        `${API_URL}/auth/logout`,
        refreshToken ? { refresh_token: refreshToken } : {},
        { withCredentials: true, headers: { 'x-skip-auth-refresh': 'true' } },
      );
    } catch (error) {
      console.log('Server logout failed; clearing local session.', error);
    }
    socketService.disconnect();
    await clearStoredSession();
    router.replace('/(auth)/login');
  };

  const saveProfile = async () => {
    try {
      setIsSavingProfile(true);
      const headers = await getAuthHeaders();
      if (!headers.Authorization) throw new Error('Sesi berakhir. Silakan login kembali.');
      if (!editDisplayName.trim()) throw new Error('Display name wajib diisi.');
      const finalAvatarUrl = await uploadProfileAvatar(editAvatar, pickedAvatar, headers);
      // Keep a successful upload if saving the text needs to be retried.
      setEditAvatar(finalAvatarUrl);
      setPickedAvatar(null);

      const res = await axios.post(`${API_URL}/auth/profile`, {
        display_name: editDisplayName.trim(),
        bio: editBio,
        status: editStatus,
        avatar_url: finalAvatarUrl
      }, {
        headers
      });
      setCurrentUser(res.data.user.display_name);
      setCurrentAvatarUrl(res.data.user.avatar_url);
      setProfileModalVisible(false);
      if (Platform.OS === 'web') alert('Profil berhasil disimpan!');
      else Alert.alert('Berhasil', 'Profil berhasil disimpan!');
    } catch (e) {
      const message = profileSaveError(e);
      if (Platform.OS === 'web') alert(message);
      else Alert.alert('Profil belum tersimpan', message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setEditAvatar(result.assets[0].uri);
      setPickedAvatar(result.assets[0]);
    }
  };

  const pickGroupAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setGroupAvatar(result.assets[0].uri);
    }
  };

  const saveGroup = async () => {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      if (Platform.OS === 'web') alert('Nama warkop wajib diisi');
      else Alert.alert('Nama warkop wajib diisi');
      return;
    }

    try {
      setIsSavingGroup(true);
      const headers = await getAuthHeaders();
      if (!headers.Authorization) throw new Error('Silakan masuk kembali.');
      const minBmcNumber = editingGroupId ? Math.max(0, Number.parseFloat(groupMinBmc || '0') || 0) : 0;
      const finalGroupAvatar = await uploadProfileAvatar(groupAvatar, null, headers);

      const payload = {
        name: trimmedName,
        description: groupDescription,
        avatarUrl: finalGroupAvatar,
        minBmcBalance: minBmcNumber,
        joinPolicy: groupJoinPolicy,
        onlyAdminsCanSend: groupOnlyAdminsCanSend,
        allowMemberInvites: groupAllowMemberInvites,
        callEnabled: groupCallEnabled,
        ...(!editingGroupId ? { memberIds: selectedMembers } : {}),
      };
      if (editingGroupId) {
        const res = await axios.put(`${API_URL}/groups/${editingGroupId}`, payload, { headers });
        setGroups(prev => prev.map(group => group.id === editingGroupId ? { ...group, ...res.data } : group));
      } else {
        const res = await axios.post(`${API_URL}/groups`, payload, { headers });
        setGroups(prev => [res.data, ...prev]);
        setActiveTab('warkop');
      }

      setGroupModalVisible(false);
      setEditingGroupId(null);
      setGroupName('');
      setGroupDescription('');
      setGroupMinBmc('0');
      setGroupAvatar('');
      setGroupJoinPolicy('open');
      setGroupOnlyAdminsCanSend(false);
      setGroupAllowMemberInvites(true);
      setGroupCallEnabled(true);
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.response?.data?.error || e.message || 'Gagal menyimpan warkop';
      if (Platform.OS === 'web') alert(errorMsg);
      else Alert.alert('Error', errorMsg);
    } finally {
      setIsSavingGroup(false);
    }
  };

  const joinGroup = async (group: any) => {
    try {
      let token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      const res = await axios.post(`${API_URL}/groups/${group.id}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 202 || res.data?.pendingApproval) {
        if (Platform.OS === 'web') alert('Permintaan join sudah dikirim. Tunggu admin menyetujui.');
        else Alert.alert('Menunggu Admin', 'Permintaan join sudah dikirim. Tunggu admin menyetujui.');
        return;
      }
      openChat(group.id, group.name, 'group');
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || 'Failed to join group';
      if (errorMsg === 'Already a member of this group') {
        openChat(group.id, group.name, 'group');
        return;
      }
      if (Platform.OS === 'web') alert(errorMsg);
      else Alert.alert('Access Denied', errorMsg);
    }
  };

  const saveSettings = async () => {
    try {
      let token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      await axios.post(`${API_URL}/settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettingsModalVisible(false);
      if (Platform.OS === 'web') alert('Settings Saved!');
      else Alert.alert('Success', 'Settings Saved!');
    } catch (e) {
      console.error(e);
      if (Platform.OS === 'web') alert('Failed to save settings');
      else Alert.alert('Error', 'Failed to save settings');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={coffee.accent} />
      </View>
    );
  }

  const getFilteredList = () => {
    let list: any[] = [];
    if (activeTab === 'semua') {
      if (!settings?.hide_contacts) list.push(...contacts.map(c => ({ ...c, _type: 'contact' })));
      if (!settings?.hide_groups) list.push(...groups.map(g => ({ ...g, _type: 'group' })));
    } else if (activeTab === 'belum_dibaca') {
      if (!settings?.hide_contacts) list.push(...contacts.filter(c => unreadCounts[c.id] > 0).map(c => ({ ...c, _type: 'contact' })));
      if (!settings?.hide_groups) list.push(...groups.filter(g => unreadCounts[g.id] > 0).map(g => ({ ...g, _type: 'group' })));
    } else if (activeTab === 'favorit') {
      // placeholder for favorit
    } else if (activeTab === 'warkop') {
      if (!settings?.hide_groups) list.push(...groups.map(g => ({ ...g, _type: 'group' })));
    }
    if (activeTab === 'semua') {
      list.unshift({
        _type: 'cs',
        id: 'bamboo-cs',
        display_name: 'NgopiCS',
        username: 'support',
        status: 'Online 24/7 untuk semua platform ekosistem',
      });
    }
    return list;
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item._type === 'cs') {
      return (
        <TouchableOpacity style={[styles.contactItem, styles.csContactItem]} onPress={openHelpCenter}>
          <View style={[styles.avatar, styles.csAvatar]}>
            <Ionicons name="headset-outline" size={24} color={coffee.text} />
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>NgopiCS</Text>
            <Text style={styles.usernameTag}>@NgopiCS</Text>
            <Text style={styles.contactStatus}>{item.status}</Text>
          </View>
          <View style={styles.onlineDotSmall} />
        </TouchableOpacity>
      );
    }

    if (item._type === 'group') {
      return (
        <TouchableOpacity style={styles.contactItem} onPress={() => joinGroup(item)}>
          <View style={[styles.avatar, { backgroundColor: coffee.button }]}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
            )}
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{item.name}</Text>
            {item.description && <Text style={styles.contactBio}>{item.description}</Text>}
            <Text style={styles.contactUsername}>{Number(item.min_bmc_balance) > 0 ? `Min ${item.min_bmc_balance} BMC` : (item.join_policy === 'approval' ? 'Masuk dengan persetujuan admin' : 'Terbuka')}</Text>
          </View>
          <View style={styles.groupActions}>
            {unreadCounts[item.id] > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCounts[item.id]}</Text>
              </View>
            )}
            {item.created_by === currentUserId && (
              <TouchableOpacity style={styles.groupEditButton} onPress={() => openEditGroupModal(item)}>
                <Ionicons name="settings-outline" size={18} color={coffee.accent} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      );
    } else {
      return (
        <TouchableOpacity style={styles.contactItem} onPress={() => openChat(item.id, item.display_name)}>
          <View style={styles.avatar}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{item.display_name.charAt(0)}</Text>
            )}
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{item.display_name}</Text>
            <Text style={styles.usernameTag}>
              @{item.username}{item.bmc_id === 0 ? '_bmc' : item.bmc_id > 0 ? `_bmc${item.bmc_id}` : ''}
            </Text>
            {item.status ? <Text style={styles.contactStatus}>{item.status}</Text> : null}
          </View>
          {unreadCounts[item.id] > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCounts[item.id]}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backToBambupediaButton} onPress={() => {
        setDropdownVisible(false);
        if (Platform.OS === 'web') {
          window.location.assign('/warkop');
        } else {
          router.replace('/(main)/warkop' as any);
        }
      }}>
        <Ionicons name="arrow-back" size={20} color={coffee.text} />
        <Text style={styles.backToBambupediaText}>Kembali</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 50 }}>
          <TouchableOpacity onPress={() => setDropdownVisible(!dropdownVisible)}>
            <View style={styles.avatar}>
              {currentAvatarUrl ? (
                <Image source={{ uri: currentAvatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{currentUser.charAt(0) || 'U'}</Text>
              )}
            </View>
          </TouchableOpacity>
          <View>
            <TouchableOpacity onPress={() => setDropdownVisible(!dropdownVisible)}>
              <Text style={styles.greeting}>Halo, {settings?.hide_name ? 'Anonymous' : currentUser} v</Text>
              <Text style={styles.usernameTag}>
                @{currentUsername}{currentBmcId === '0' ? '_bmc' : currentBmcId ? `_bmc${currentBmcId}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity onPress={() => setDropdownVisible(true)}>
          <Text style={styles.logoutText}>Menu</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput style={styles.searchInput} placeholder="Cari atau mulai obrolan baru" placeholderTextColor={coffee.secondary} />
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.gameLobbyButton} onPress={() => router.push('/(main)/games' as any)}>
          <Ionicons name="game-controller-outline" size={18} color={coffee.accent} />
          <Text style={styles.gameLobbyButtonText}>Meja Warkop 🎮</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpCenterButton} onPress={openHelpCenter}>
          <Ionicons name="help-circle-outline" size={18} color={coffee.text} />
          <Text style={styles.helpCenterButtonText}>Pusat Bantuan</Text>
        </TouchableOpacity>
        {(currentRole === 'admin' || currentRole === 'agent') && (
          <TouchableOpacity style={styles.adminButton} onPress={openAdminDashboard}>
            <Ionicons name="shield-checkmark-outline" size={18} color={coffee.accent} />
            <Text style={styles.adminButtonText}>CS Dashboard</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ marginBottom: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
          <TouchableOpacity style={[styles.chip, activeTab === 'semua' && styles.activeChip]} onPress={() => setActiveTab('semua')}>
            <Text style={[styles.chipText, activeTab === 'semua' && styles.activeChipText]}>Semua</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, activeTab === 'belum_dibaca' && styles.activeChip]} onPress={() => setActiveTab('belum_dibaca')}>
            <Text style={[styles.chipText, activeTab === 'belum_dibaca' && styles.activeChipText]}>Belum dibaca</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, activeTab === 'favorit' && styles.activeChip]} onPress={() => setActiveTab('favorit')}>
            <Text style={[styles.chipText, activeTab === 'favorit' && styles.activeChipText]}>Favorit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, activeTab === 'warkop' && styles.activeChip]} onPress={() => setActiveTab('warkop')}>
            <Text style={[styles.chipText, activeTab === 'warkop' && styles.activeChipText]}>Warkop {groups.length}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {(
        <TouchableOpacity style={styles.createGroupBtn} onPress={openCreateGroupModal}>
          <Text style={styles.createGroupBtnText}>+ Buat Warkop Baru</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={getFilteredList()}
        keyExtractor={item => item._type + item.id}
        renderItem={renderItem}
        contentContainerStyle={getFilteredList().length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined}
        ListEmptyComponent={
          <EmptyState
            icon={activeTab === 'warkop' ? '☕' : '👥'}
            title={activeTab === 'warkop' ? 'Belum Ada Warkop' : 'Belum Ada Kontak'}
            description={
              activeTab === 'warkop'
                ? 'Belum ada warkop komunitas. Buat warkop baru atau gabung lewat tautan undangan!'
                : 'Belum ada obrolan atau kontak tersimpan. Yuk mulai cari teman di Warung Kopi!'
            }
            primaryAction={
              activeTab === 'warkop'
                ? { label: '+ Buat Warkop Baru', onPress: openCreateGroupModal }
                : { label: 'Masuk Warung Kopi ☕', onPress: () => router.push('/(main)/warkop' as any) }
            }
          />
        }
      />

      {/* Online Users Horizontal Bar */}
      {onlineUsers.length > 0 && !settings?.hide_contacts && (
        <View style={styles.onlineBar}>
          <Text style={{ color: coffee.accent, fontSize: 12, marginBottom: 8, fontWeight: 'bold' }}>Online Now</Text>
          <FlatList
            horizontal
            data={onlineUsers}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.onlineUserItem} onPress={() => openChat(item.id, item.display_name)}>
                <View style={[styles.avatar, { width: 40, height: 40, borderRadius: 20, marginRight: 8, borderWidth: 2, borderColor: coffee.accent }]}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{item.display_name.charAt(0)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Profile Modal */}
      <Modal visible={isProfileModalVisible} transparent={true} animationType="slide" onRequestClose={() => setProfileModalVisible(false)}>
        <KeyboardAvoidingView style={[styles.modalOverlay, { padding: 16 }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.profileModalContent}>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalTitle, { fontSize: 24, textAlign: 'center', marginBottom: 24, color: coffee.accent }]}>Profil Saya</Text>

            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={pickImage} style={{ alignItems: 'center' }}>
                <View style={[styles.avatar, { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: coffee.accent }]}>
                  {editAvatar ? (
                    <Image source={{ uri: editAvatar }} style={{ width: 100, height: 100, borderRadius: 50 }} />
                  ) : (
                    <Text style={[styles.avatarText, { fontSize: 40 }]}>{editDisplayName.charAt(0) || 'U'}</Text>
                  )}
                </View>
                <Text style={{ color: coffee.secondary, marginTop: 12, fontWeight: 'bold', fontSize: 14 }}>Ketuk untuk mengganti foto</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput style={styles.inputField} placeholder="Enter your display name" placeholderTextColor={coffee.muted} maxLength={50} value={editDisplayName} onChangeText={setEditDisplayName} />

            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput style={styles.inputField} placeholder="A short bio about you" placeholderTextColor={coffee.muted} multiline maxLength={500} value={editBio} onChangeText={setEditBio} />

            <Text style={styles.inputLabel}>Status</Text>
            <TextInput style={styles.inputField} placeholder="e.g. Online, Busy, At Work" placeholderTextColor={coffee.muted} maxLength={120} value={editStatus} onChangeText={setEditStatus} />

            <Text style={styles.inputLabel}>Profile Link</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <TextInput
                style={[styles.inputField, { flex: 1, minWidth: 0, marginBottom: 0, color: coffee.accent, backgroundColor: coffee.surface }]}
                value={profileLink}
                editable={false}
              />
              <TouchableOpacity
                style={{ marginLeft: 10, padding: 12, backgroundColor: coffee.border, borderRadius: 8, height: 48, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    navigator.clipboard.writeText(profileLink);
                    alert('Link profil disalin!');
                  } else {
                    Alert.alert('Info', 'Fitur copy tersedia di web.');
                  }
                }}
              >
                <Ionicons name="copy-outline" size={20} color={coffee.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: coffee.muted, marginBottom: 12 }}>Tautan mengikuti nama yang sudah disimpan.</Text>
            </ScrollView>
            <View style={[styles.modalActions, { padding: 16, flexWrap: 'wrap', gap: 8 }]}>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)} style={[styles.cancelBtn, { backgroundColor: coffee.border, borderRadius: 8, paddingHorizontal: 20 }]}>
                <Text style={[styles.cancelBtnText, { color: coffee.text }]}>Tutup</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? <ActivityIndicator color={coffee.text} /> : <Text style={styles.saveBtnText}>Simpan Perubahan</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={isSettingsModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Privacy Settings</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 16 }}>
              <Text style={{ color: coffee.text, fontSize: 16 }}>Hide My Name</Text>
              <TouchableOpacity
                style={[styles.toggleBtn, settings?.hide_name && styles.toggleBtnActive]}
                onPress={() => setSettings({ ...settings, hide_name: !settings?.hide_name })}
              >
                <View style={[styles.toggleKnob, settings?.hide_name && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: coffee.text, fontSize: 16 }}>Hide Contacts Tab</Text>
              <TouchableOpacity
                style={[styles.toggleBtn, settings?.hide_contacts && styles.toggleBtnActive]}
                onPress={() => setSettings({ ...settings, hide_contacts: !settings?.hide_contacts })}
              >
                <View style={[styles.toggleKnob, settings?.hide_contacts && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ color: coffee.text, fontSize: 16 }}>Hide Warkop Tab</Text>
              <TouchableOpacity
                style={[styles.toggleBtn, settings?.hide_groups && styles.toggleBtnActive]}
                onPress={() => setSettings({ ...settings, hide_groups: !settings?.hide_groups })}
              >
                <View style={[styles.toggleKnob, settings?.hide_groups && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveSettings} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save Preferences</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal visible={isGroupModalVisible} transparent={true} animationType="fade" onRequestClose={() => setGroupModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.groupModalContent]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingGroupId ? 'Pengaturan Warkop' : 'Buat Warkop Baru'}</Text>
              <TouchableOpacity style={styles.groupAvatarPicker} onPress={pickGroupAvatar}>
                <View style={[styles.avatar, styles.groupAvatarLarge]}>
                  {groupAvatar ? (
                    <Image source={{ uri: groupAvatar }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="people-outline" size={28} color={coffee.text} />
                  )}
                </View>
                <View style={styles.groupAvatarTextWrap}>
                  <Text style={styles.inputLabel}>Avatar Warkop</Text>
                  <Text style={styles.groupHint}>Ketuk untuk upload logo/foto warkop.</Text>
                </View>
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Nama Warkop"
                placeholderTextColor={coffee.muted}
                value={groupName}
                onChangeText={setGroupName}
              />
              <TextInput
                style={[styles.input, styles.textAreaInput]}
                placeholder="Deskripsi Singkat (Opsional)"
                placeholderTextColor={coffee.muted}
                value={groupDescription}
                onChangeText={setGroupDescription}
                multiline
              />
              {!editingGroupId && <View>
                <Text style={styles.inputLabel}>Pilih anggota ({selectedMembers.length})</Text>
                <TextInput style={styles.input} placeholder="Cari nama atau username" placeholderTextColor={coffee.muted} value={memberSearch} onChangeText={setMemberSearch} />
                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                  {contacts.filter(user => user.id !== currentUserId && `${user.display_name} ${user.username}`.toLowerCase().includes(memberSearch.toLowerCase())).map(user => <TouchableOpacity key={user.id} style={{ paddingVertical: 10, flexDirection: 'row', gap: 10 }} onPress={() => setSelectedMembers(previous => previous.includes(user.id) ? previous.filter(id => id !== user.id) : [...previous, user.id])}>
                    <Ionicons name={selectedMembers.includes(user.id) ? 'checkbox' : 'square-outline'} size={22} color={coffee.accent} />
                    <Text style={{ color: coffee.text, flex: 1 }}>{user.display_name || user.username} (@{user.username})</Text>
                  </TouchableOpacity>)}
                </ScrollView>
                <Text style={styles.groupHint}>Warkop tampil di direktori. Pilih persetujuan admin untuk membatasi siapa yang bisa bergabung.</Text>
              </View>}

              <Text style={styles.inputLabel}>Cara Join</Text>
              <View style={styles.segmentRow}>
                <TouchableOpacity style={[styles.segmentButton, groupJoinPolicy === 'open' && styles.segmentButtonActive]} onPress={() => setGroupJoinPolicy('open')}>
                  <Text style={[styles.segmentText, groupJoinPolicy === 'open' && styles.segmentTextActive]}>Terbuka</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.segmentButton, groupJoinPolicy === 'approval' && styles.segmentButtonActive]} onPress={() => setGroupJoinPolicy('approval')}>
                  <Text style={[styles.segmentText, groupJoinPolicy === 'approval' && styles.segmentTextActive]}>Disetujui Admin</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Hanya admin bisa kirim pesan</Text>
                  <Text style={styles.groupHint}>Cocok untuk channel pengumuman.</Text>
                </View>
                <TouchableOpacity style={[styles.toggleBtn, groupOnlyAdminsCanSend && styles.toggleBtnActive]} onPress={() => setGroupOnlyAdminsCanSend(!groupOnlyAdminsCanSend)}>
                  <View style={[styles.toggleKnob, groupOnlyAdminsCanSend && styles.toggleKnobActive]} />
                </TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Member boleh invite</Text>
                  <Text style={styles.groupHint}>Admin tetap bisa regenerasi link nanti.</Text>
                </View>
                <TouchableOpacity style={[styles.toggleBtn, groupAllowMemberInvites && styles.toggleBtnActive]} onPress={() => setGroupAllowMemberInvites(!groupAllowMemberInvites)}>
                  <View style={[styles.toggleKnob, groupAllowMemberInvites && styles.toggleKnobActive]} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => { setGroupModalVisible(false); setEditingGroupId(null); }} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveGroup} style={styles.saveBtn} disabled={isSavingGroup}>
                  {isSavingGroup ? <ActivityIndicator color={coffee.text} /> : <Text style={styles.saveBtnText}>{editingGroupId ? 'Simpan' : 'Buat'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={dropdownVisible} transparent={true} animationType="slide" onRequestClose={() => setDropdownVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Pengaturan Akun</Text>
            <TouchableOpacity style={styles.actionSheetItem} onPress={() => { setDropdownVisible(false); setProfileModalVisible(true); }}>
              <Text style={styles.actionSheetText}>Profil Saya</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionSheetItem} onPress={() => { setDropdownVisible(false); setSettingsModalVisible(true); }}>
              <Text style={styles.actionSheetText}>Pengaturan Privasi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                const next = nightSetting === 'auto' ? 'on' : nightSetting === 'on' ? 'off' : 'auto';
                setNightSetting(next);
              }}
            >
              <Text style={styles.actionSheetText}>
                Mode Ngobrol Malam 🌙: <Text style={{ color: coffee.accent, fontWeight: '700' }}>{nightSetting.toUpperCase()}</Text>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionSheetItem} onPress={() => { setDropdownVisible(false); router.push('/privacy'); }}>
              <Text style={styles.actionSheetText}>Kebijakan Privasi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionSheetItem} onPress={() => { setDropdownVisible(false); router.push('/terms'); }}>
              <Text style={styles.actionSheetText}>Syarat & Ketentuan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionSheetItem, { borderBottomWidth: 0 }]} onPress={() => { setDropdownVisible(false); handleLogout(); }}>
              <Text style={[styles.actionSheetText, { color: coffee.danger }]}>Keluar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: coffee.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: coffee.background,
  },
  backToBambupediaButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  backToBambupediaText: {
    color: coffee.text,
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
  },
  greeting: {
    fontSize: 18,
    color: coffee.text,
    fontWeight: 'bold',
  },
  actionSheet: {
    backgroundColor: coffee.surface,
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    shadowColor: coffee.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 10,
  },
  actionSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: coffee.border,
    borderRadius: 2,
    marginBottom: 16,
  },
  actionSheetTitle: {
    color: coffee.secondary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  actionSheetItem: {
    width: '100%',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    alignItems: 'center',
  },
  actionSheetText: {
    color: coffee.text,
    fontSize: 16,
    fontWeight: '500',
  },
  walletText: {
    color: coffee.accent,
    fontSize: 14,
    marginTop: 4,
  },
  logoutText: {
    color: coffee.danger,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: coffee.surface,
    color: coffee.text,
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    fontSize: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  gameLobbyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: coffee.raised,
    borderWidth: 1,
    borderColor: coffee.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  gameLobbyButtonText: {
    color: coffee.accent,
    fontWeight: '800',
  },
  helpCenterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: coffee.button,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  helpCenterButtonText: {
    color: coffee.text,
    fontWeight: '800',
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: coffee.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  adminButtonText: {
    color: coffee.accent,
    fontWeight: '800',
  },
  chipsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: coffee.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activeChip: {
    backgroundColor: coffee.highlight, // dark green
  },
  chipText: {
    color: coffee.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  activeChipText: {
    color: coffee.accent, // bright green
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  csContactItem: {
    borderWidth: 1,
    borderColor: coffee.accent,
    backgroundColor: coffee.highlight,
  },
  csAvatar: {
    backgroundColor: coffee.button,
  },
  onlineDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: coffee.successButton,
    marginLeft: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: coffee.button,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  avatarText: {
    color: coffee.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    color: coffee.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  usernameTag: {
    fontSize: 13,
    color: coffee.secondary,
    marginBottom: 4,
  },
  contactStatus: {
    fontSize: 12,
    color: coffee.accent,
  },
  contactUsername: {
    fontSize: 14,
    color: coffee.muted,
  },
  contactBio: {
    fontSize: 13,
    color: coffee.secondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  groupActions: {
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  groupEditButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: coffee.highlight,
    borderWidth: 1,
    borderColor: coffee.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    backgroundColor: coffee.dangerButton,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  lockBadge: {
    backgroundColor: coffee.border,
    borderRadius: 12,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadgeText: {
    fontSize: 16,
  },
  createGroupBtn: {
    backgroundColor: coffee.border,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: coffee.accent,
    borderStyle: 'dashed',
  },
  createGroupBtnText: {
    color: coffee.accent,
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: coffee.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: coffee.surface,
    borderRadius: 16,
    padding: 24,
  },
  profileModalContent: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '100%',
    flexShrink: 1,
    backgroundColor: coffee.background,
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupModalContent: {
    maxHeight: '88%',
  },
  groupAvatarPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 16,
  },
  groupAvatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    backgroundColor: coffee.button,
  },
  groupAvatarTextWrap: {
    flex: 1,
  },
  groupHint: {
    color: coffee.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
  textAreaInput: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    backgroundColor: coffee.background,
    alignItems: 'center',
  },
  segmentButtonActive: {
    borderColor: coffee.accent,
    backgroundColor: coffee.highlight,
  },
  segmentText: {
    color: coffee.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: coffee.accent,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: coffee.border,
  },
  settingTextWrap: {
    flex: 1,
  },
  settingTitle: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },  modalTitle: {
    color: coffee.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalDesc: {
    color: coffee.secondary,
    fontSize: 14,
    marginBottom: 16,
  },
  inputField: {
    backgroundColor: coffee.surface,
    color: coffee.text,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: coffee.border,
    fontSize: 16,
  },
  inputLabel: {
    color: coffee.secondary,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: coffee.background,
    color: coffee.text,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: 12,
    marginRight: 8,
  },
  cancelBtnText: {
    color: coffee.secondary,
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: coffee.button,
    padding: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  saveBtnText: {
    color: coffee.text,
    fontWeight: 'bold',
  },
  toggleBtn: {
    width: 50,
    height: 28,
    backgroundColor: coffee.border,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: coffee.button,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: coffee.surface,
    borderRadius: 12,
    transform: [{ translateX: 0 }],
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  onlineBar: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: coffee.surface,
    marginTop: 8,
  },
  onlineUserItem: {
    alignItems: 'center',
  }
});
