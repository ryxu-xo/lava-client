/**
 * VoiceForwarder - Handles Discord voice state updates
 * Intercepts VOICE_SERVER_UPDATE and VOICE_STATE_UPDATE events
 * and forwards them to the appropriate Lavalink node
 */

import type {
  DiscordVoiceEvent,
  DiscordVoiceServerUpdate,
  DiscordVoiceStateUpdate,
  DiscordVoicePayload,
  VoiceState,
} from '../types/lavalink';
import type { Player } from '../player/Player';
import type { LavalinkEventEmitter } from './events';

export interface VoiceConnection {
  guildId: string;
  channelId: string | null;
  sessionId?: string;
  token?: string;
  endpoint?: string;
}

export class VoiceForwarder {
  private voiceStates: Map<string, VoiceConnection> = new Map();
  private eventEmitter: LavalinkEventEmitter;
  private sendPayload: (guildId: string, payload: DiscordVoicePayload) => void;
  private clientId: string;

  constructor(
    clientId: string,
    sendPayload: (guildId: string, payload: DiscordVoicePayload) => void,
    eventEmitter: LavalinkEventEmitter
  ) {
    this.clientId = clientId;
    this.sendPayload = sendPayload;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Process voice state updates from Discord
   */
  public async handleVoiceUpdate(packet: DiscordVoiceEvent, player?: Player): Promise<void> {
    if (packet.t === 'VOICE_SERVER_UPDATE') {
      await this.handleVoiceServerUpdate(packet, player);
    } else if (packet.t === 'VOICE_STATE_UPDATE') {
      await this.handleVoiceStateUpdate(packet, player);
    }
  }

  /**
   * Handle VOICE_SERVER_UPDATE from Discord
   */
  private async handleVoiceServerUpdate(
    packet: DiscordVoiceServerUpdate,
    player?: Player
  ): Promise<void> {
    const { guild_id, token, endpoint } = packet.d;

    this.eventEmitter.emit('debug', `Voice server update for guild ${guild_id}`);

    // Get or create voice connection state
    let voiceState = this.voiceStates.get(guild_id);
    if (!voiceState) {
      voiceState = {
        guildId: guild_id,
        channelId: null,
      };
      this.voiceStates.set(guild_id, voiceState);
    }

    // Update token and endpoint
    voiceState.token = token;
    voiceState.endpoint = endpoint;

    // If we have complete voice state, forward to Lavalink
    if (player && voiceState.sessionId) {
      await this.forwardVoiceState(player, voiceState);
    }
  }

  /**
   * Handle VOICE_STATE_UPDATE from Discord
   */
  private async handleVoiceStateUpdate(
    packet: DiscordVoiceStateUpdate,
    player?: Player
  ): Promise<void> {
    const { guild_id, user_id, session_id, channel_id } = packet.d;

    // Only process updates for our bot
    if (user_id !== this.clientId) {
      return;
    }

    this.eventEmitter.emit('debug', `Voice state update for guild ${guild_id}`);

    // Get or create voice connection state
    let voiceState = this.voiceStates.get(guild_id);
    if (!voiceState) {
      voiceState = {
        guildId: guild_id,
        channelId: channel_id,
      };
      this.voiceStates.set(guild_id, voiceState);
    }

    // Update session ID and channel
    voiceState.sessionId = session_id;
    voiceState.channelId = channel_id;

    // If bot left the voice channel, clean up
    if (!channel_id) {
      this.voiceStates.delete(guild_id);
      if (player) {
        await player.disconnect();
      }
      return;
    }

    // If player moved to a different channel
    if (player && player.voiceChannelId !== channel_id) {
      const oldChannel = player.voiceChannelId;
      this.eventEmitter.emit('playerMove', player, oldChannel, channel_id);
    }

    // If we have complete voice state, forward to Lavalink
    if (player && voiceState.token && voiceState.endpoint) {
      await this.forwardVoiceState(player, voiceState);
    }
  }

  /**
   * Forward complete voice state to Lavalink
   */
  private async forwardVoiceState(
    player: Player,
    voiceState: VoiceConnection
  ): Promise<void> {
    if (!voiceState.sessionId || !voiceState.token || !voiceState.endpoint) {
      throw new Error('Incomplete voice state');
    }

    const lavalinkVoiceState: VoiceState = {
      token: voiceState.token,
      endpoint: voiceState.endpoint,
      sessionId: voiceState.sessionId,
    };

    await player.updateVoiceState(lavalinkVoiceState);
    this.eventEmitter.emit(
      'debug',
      `Forwarded voice state to Lavalink for guild ${player.guildId}`
    );
  }

  /**
   * Send voice state update to Discord
   */
  public sendVoiceUpdate(
    guildId: string,
    channelId: string | null,
    options?: {
      selfMute?: boolean;
      selfDeaf?: boolean;
    }
  ): void {
    const payload: DiscordVoicePayload = {
      op: 4, // VOICE_STATE_UPDATE opcode
      d: {
        guild_id: guildId,
        channel_id: channelId,
        self_mute: options?.selfMute ?? false,
        self_deaf: options?.selfDeaf ?? false,
      },
    };

    this.sendPayload(guildId, payload);
    this.eventEmitter.emit(
      'debug',
      `Sent voice update to Discord for guild ${guildId}, channel ${channelId}`
    );
  }

  /**
   * Get voice connection state for a guild
   */
  public getVoiceState(guildId: string): VoiceConnection | undefined {
    return this.voiceStates.get(guildId);
  }

  /**
   * Clear voice state for a guild
   */
  public clearVoiceState(guildId: string): void {
    this.voiceStates.delete(guildId);
  }

  /**
   * Clear all voice states
   */
  public clearAllVoiceStates(): void {
    this.voiceStates.clear();
  }

  /**
   * Get all voice states
   */
  public getAllVoiceStates(): Map<string, VoiceConnection> {
    return new Map(this.voiceStates);
  }
}
