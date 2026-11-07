/**
 * Parser for the Quadro live report (HID input report 0x01, 220 bytes, big-endian, no CRC).
 * See docs/PROTOCOL.md. Dependency-free so it can be unit-tested with plain Node.
 */
export const STATUS_REPORT_ID = 0x01;
export const STATUS_LEN = 0xdc;

const OFF = {
  serial1: 0x03,
  serial2: 0x05,
  firmware: 0x0d,
  uptime: 0x14,
  powerCycles: 0x18,
  temp: 0x34,
  virtualTemp: 0x3c,
  voltageIn: 0x6c,
  flow: 0x6e,
  fans: [0x70, 0x7d, 0x8a, 0x97],
} as const;

const FAN = { pwm: 0x00, voltage: 0x02, current: 0x04, power: 0x06, speed: 0x08 } as const;
const TEMP_DISABLED = 0x7fff;

export interface FanStatus {
  rpm: number;
  pwmPercent: number;
  voltageV: number;
  currentA: number;
  powerW: number;
}

export interface QuadroStatus {
  serial: string;
  firmware: number;
  powerCycles: number;
  uptimeS: number;
  inputVoltageV: number;
  flowLPerH: number;
  /** °C, null = sensor not connected */
  temps: (number | null)[];
  virtualTemps: (number | null)[];
  fans: FanStatus[];
}

const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const temp = (b: Uint8Array, o: number): number | null => {
  const raw = u16(b, o);
  if (raw === TEMP_DISABLED) return null;
  return (raw > 0x7fff ? raw - 0x10000 : raw) / 100;
};

/**
 * Normalizes what the HID layer delivers: some platforms strip the report ID.
 * Returns a buffer that starts with the report ID, or undefined if it is not a status report.
 */
export function normalizeReport(data: Uint8Array): Uint8Array | undefined {
  if (data.length >= STATUS_LEN && data[0] === STATUS_REPORT_ID) return data;
  if (data.length === STATUS_LEN - 1) {
    const out = new Uint8Array(STATUS_LEN);
    out[0] = STATUS_REPORT_ID;
    out.set(data, 1);
    return out;
  }
  return undefined;
}

export function parseStatus(buf: Uint8Array): QuadroStatus {
  if (buf.length < STATUS_LEN) throw new Error(`Status report too short: ${buf.length} bytes`);

  return {
    serial: `${String(u16(buf, OFF.serial1)).padStart(5, "0")}-${String(u16(buf, OFF.serial2)).padStart(5, "0")}`,
    firmware: u16(buf, OFF.firmware),
    powerCycles: u32(buf, OFF.powerCycles),
    uptimeS: u32(buf, OFF.uptime),
    inputVoltageV: u16(buf, OFF.voltageIn) / 100,
    flowLPerH: u16(buf, OFF.flow) / 10,
    temps: Array.from({ length: 4 }, (_, i) => temp(buf, OFF.temp + i * 2)),
    virtualTemps: Array.from({ length: 16 }, (_, i) => temp(buf, OFF.virtualTemp + i * 2)),
    fans: OFF.fans.map((base) => ({
      pwmPercent: u16(buf, base + FAN.pwm) / 100,
      voltageV: u16(buf, base + FAN.voltage) / 100,
      currentA: u16(buf, base + FAN.current) / 1000,
      powerW: u16(buf, base + FAN.power) / 100,
      rpm: u16(buf, base + FAN.speed),
    })),
  };
}
