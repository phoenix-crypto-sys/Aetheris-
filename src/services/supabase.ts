import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { AetherisPacket } from '../layer1_radio/types';

const env = process.env as Record<string, string | undefined>;
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL || 'https://aetheris-mesh-demo.supabase.co';
const SUPABASE_ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldGhlcmlzLW1lc2gtZGVtbyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzA0MDY3MjAwLCJleHAiOjIwMTk2NDMyMDB9.mock-key-for-aetheris-airwaves-demo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

type PacketListenerCallback = (packet: AetherisPacket) => void;
const fallbackListeners: Set<PacketListenerCallback> = new Set();

export class AetherisAirwavesChannel {
  private channel: RealtimeChannel | null = null;
  private channelName: string;

  constructor(channelName: string = 'aetheris_mesh') {
    this.channelName = channelName;
    try {
      this.channel = supabase.channel(this.channelName, {
        config: {
          broadcast: { self: true },
        },
      });

      this.channel.subscribe((status) => {
        console.log(`[Supabase Realtime] Channel '${this.channelName}' status:`, status);
      });
    } catch (err) {
      console.warn('[Supabase Realtime] Connection failed, using in-memory broadcast fallback.', err);
    }
  }

  public subscribe(callback: PacketListenerCallback): () => void {
    if (this.channel) {
      this.channel.on('broadcast', { event: 'node-telemetry' }, (response) => {
        if (response && response.payload) {
          callback(response.payload as AetherisPacket);
        }
      });
    }

    fallbackListeners.add(callback);

    return () => {
      fallbackListeners.delete(callback);
      if (this.channel) {
        this.channel.unsubscribe();
      }
    };
  }

  public async broadcast(packet: AetherisPacket): Promise<void> {
    fallbackListeners.forEach((listener) => {
      try {
        listener(packet);
      } catch (err) {
        console.error('[AirwavesChannel] Error in listener callback:', err);
      }
    });

    if (this.channel) {
      try {
        await this.channel.send({
          type: 'broadcast',
          event: 'node-telemetry',
          payload: packet,
        });
      } catch (err) {
        // Fallback already executed
      }
    }
  }
}

