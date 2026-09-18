import { prisma } from './server'
import type { DeviceInfo } from './schemas'

export class DeviceRegistrationService {
  /**
   * Find or create DeviceType based on device specs
   * Matches on: manufacturer, model, resolution
   */
  async findOrCreateDeviceType(deviceInfo: DeviceInfo) {
    const { manufacturer, model, displayMetrics, screenRefreshRate } = deviceInfo

    // Try to find existing DeviceType
    const existingType = await prisma.deviceType.findFirst({
      where: {
        manufacturer,
        model,
        widthPixels: displayMetrics.widthPixels,
        heightPixels: displayMetrics.heightPixels,
      },
    })

    if (existingType) {
      return existingType
    }

    // Create new DeviceType
    return await prisma.deviceType.create({
      data: {
        name: `${manufacturer} ${model}`,
        osType: 'ANDROID',
        manufacturer,
        model,
        apiLevel: deviceInfo.apiLevel ?? null,
        widthPixels: displayMetrics.widthPixels,
        heightPixels: displayMetrics.heightPixels,
        screenRefreshRate: screenRefreshRate ?? null,
        densityDpi: displayMetrics.densityDpi,
        density: displayMetrics.density,
      },
    })
  }

  /**
   * Register or update device for a user
   */
  async registerDevice(userId: string, deviceInfo: DeviceInfo) {
    // Find or create device type
    const deviceType = await this.findOrCreateDeviceType(deviceInfo)

    // Check if device already exists
    const existingDevice = await prisma.device.findUnique({
      where: { deviceId: deviceInfo.deviceId },
    })

    if (existingDevice) {
      // Update existing device
      return await prisma.device.update({
        where: { deviceId: deviceInfo.deviceId },
        data: {
          userId,
          name: deviceInfo.name,
          deviceTypeId: deviceType.id,
          osVersion: deviceInfo.osVersion,
          status: 'online',
          lastActive: new Date(),
        },
      })
    }

    // Create new device
    return await prisma.device.create({
      data: {
        userId,
        name: deviceInfo.name,
        deviceId: deviceInfo.deviceId,
        deviceTypeId: deviceType.id,
        osVersion: deviceInfo.osVersion,
        status: 'online',
      },
    })
  }
}

export const deviceRegistrationService = new DeviceRegistrationService()
