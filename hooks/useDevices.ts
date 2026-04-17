import { useState } from 'react';
import { startScan, stopScan } from '../services/ble.service';

export const useDevices = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [trackedDevice, setTrackedDevice] = useState<any>(null);

  const scanDevices = () => {
    setDevices([]);

    startScan((device: any) => {
      setDevices((prev) => {
        const exists = prev.find((d) => d.id === device.id);

        if (exists) {
          const updated = prev.map((d) =>
            d.id === device.id ? device : d
          );

          if (trackedDevice?.id === device.id) {
            setTrackedDevice(device);
          }

          return updated;
        }

        return [...prev, device];
      });
    });
  };

  return {
    devices,
    trackedDevice,
    setTrackedDevice,
    scanDevices,
    stopScan,
  };
};