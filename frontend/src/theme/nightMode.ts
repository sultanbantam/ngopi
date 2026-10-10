import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export type NightModeSetting = 'auto' | 'on' | 'off';

const NIGHT_MODE_STORAGE_KEY = 'ngopi_night_mode_setting';

export const isNightHour = (): boolean => {
  const hour = new Date().getHours();
  return hour >= 21 || hour < 5;
};

export const getStoredNightModeSetting = (): NightModeSetting => {
  if (Platform.OS === 'web') {
    const val = localStorage.getItem(NIGHT_MODE_STORAGE_KEY);
    if (val === 'on' || val === 'off' || val === 'auto') return val;
  }
  return 'auto';
};

export const saveNightModeSetting = (setting: NightModeSetting) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(NIGHT_MODE_STORAGE_KEY, setting);
  }
};

export const useNightMode = () => {
  const [setting, setSetting] = useState<NightModeSetting>('auto');
  const [isNightActive, setIsNightActive] = useState<boolean>(false);

  useEffect(() => {
    const initial = getStoredNightModeSetting();
    setSetting(initial);

    const updateActive = (currSetting: NightModeSetting) => {
      if (currSetting === 'on') {
        setIsNightActive(true);
      } else if (currSetting === 'off') {
        setIsNightActive(false);
      } else {
        setIsNightActive(isNightHour());
      }
    };

    updateActive(initial);

    // Re-check periodically every 60s
    const interval = setInterval(() => {
      updateActive(getStoredNightModeSetting());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const changeSetting = (newSetting: NightModeSetting) => {
    setSetting(newSetting);
    saveNightModeSetting(newSetting);
    if (newSetting === 'on') {
      setIsNightActive(true);
    } else if (newSetting === 'off') {
      setIsNightActive(false);
    } else {
      setIsNightActive(isNightHour());
    }
  };

  return {
    setting,
    isNightActive,
    changeSetting,
  };
};
