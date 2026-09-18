import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";
import { InfraConfig, resourceName } from "./config.js";

export interface MonitoringResult {
  cpuAlert: digitalocean.MonitorAlert;
  memoryAlert: digitalocean.MonitorAlert;
  diskAlert: digitalocean.MonitorAlert;
}

export interface MonitoringArgs {
  dropletIds: pulumi.Input<string[]>;
}

/**
 * Create monitoring alerts for droplets
 */
export function createMonitoring(
  config: InfraConfig,
  args: MonitoringArgs
): MonitoringResult {
  // CPU Alert - > 80% for 5 minutes
  const cpuAlert = new digitalocean.MonitorAlert(
    resourceName(config, "cpu-alert"),
    {
      alerts: {
        emails: config.alertEmails,
      },
      window: "5m",
      type: "v1/insights/droplet/cpu",
      compare: "GreaterThan",
      value: 80,
      enabled: true,
      entities: args.dropletIds,
      description: `High CPU usage alert for ${config.projectName} ${config.environment}`,
    }
  );

  // Memory Alert - > 85% for 5 minutes
  const memoryAlert = new digitalocean.MonitorAlert(
    resourceName(config, "memory-alert"),
    {
      alerts: {
        emails: config.alertEmails,
      },
      window: "5m",
      type: "v1/insights/droplet/memory_utilization_percent",
      compare: "GreaterThan",
      value: 85,
      enabled: true,
      entities: args.dropletIds,
      description: `High memory usage alert for ${config.projectName} ${config.environment}`,
    }
  );

  // Disk Alert - > 90%
  const diskAlert = new digitalocean.MonitorAlert(
    resourceName(config, "disk-alert"),
    {
      alerts: {
        emails: config.alertEmails,
      },
      window: "5m",
      type: "v1/insights/droplet/disk_utilization_percent",
      compare: "GreaterThan",
      value: 90,
      enabled: true,
      entities: args.dropletIds,
      description: `High disk usage alert for ${config.projectName} ${config.environment}`,
    }
  );

  return {
    cpuAlert,
    memoryAlert,
    diskAlert,
  };
}
