/**
 * Player class - Manages audio playback for a guild
 * Handles v4 REST API operations, filters, and queue management
 */

import { FilterBuilder } from './FilterBuilder';
import { AutoPlay } from '../utils/autoplay';
import type { Node } from '../nodes/Node';
import type { LavalinkEventEmitter } from '../manager/events';
import type {
  PlayerOptions,
  Track,
  FilterOptions,
  VoiceState,
  LoadResult,
  SearchPlatformType,
} from '../types/lavalink';

export interface PlayerState {
  volume: number;
  paused: boolean;
  position: number;
  connected: boolean;
  ping: number;
}

export class Player {
  public readonly guildId: string;
  public readonly voiceChannelId: string;
  public textChannelId?: string;

  public node: Node;
  public track: Track | null = null;
  public volume: number = 100;
  public paused: boolean = false;
  public position: number = 0;
  public connected: boolean = false;
  public ping: number = 0;
  public voiceState: Partial<VoiceState> = {};

  public queue: Track[] = [];
  public previousTracks: Track[] = [];
  public history: Track[] = [];

  // Loop modes
  public loopMode: 'off' | 'track' | 'queue' = 'off';
  
  // Crossfade settings
  public crossfadeDuration: number = 0; // ms
  
  // Volume normalization
  public volumeNormalization: boolean = false;

  private filterBuilder: FilterBuilder;
  private autoPlayEngine: AutoPlay;
  private eventEmitter: LavalinkEventEmitter;
  private autoPlay: boolean;
  private defaultSearchPlatform: SearchPlatformType;
  // Configuration flags (not currently used directly; kept for future use)
  private readonly selfDeafen: boolean;
  private readonly selfMute: boolean;
  private positionUpdateInterval: NodeJS.Timeout | null = null;
  private historyMaxSize: number = 50;

  constructor(
    options: PlayerOptions,
    node: Node,
    eventEmitter: LavalinkEventEmitter,
    autoPlay: boolean = true,
    defaultSearchPlatform: SearchPlatformType = 'ytsearch'
  ) {
    this.guildId = options.guildId;
    this.voiceChannelId = options.voiceChannelId;
    this.textChannelId = options.textChannelId;
    this.volume = options.volume ?? 100;
    this.selfDeafen = options.selfDeafen ?? false;
    this.selfMute = options.selfMute ?? false;

    this.node = node;
    this.eventEmitter = eventEmitter;
    this.autoPlay = autoPlay;
    this.defaultSearchPlatform = defaultSearchPlatform;
    this.filterBuilder = new FilterBuilder(this);
    this.autoPlayEngine = new AutoPlay();
  }

  // ==================== Connection Management ====================

  /**
   * Connect to the voice channel
   */
  public async connect(): Promise<void> {
    this.eventEmitter.emit('debug', `Player connecting to guild ${this.guildId}`);
    // Reference configuration flags to avoid unused warnings and document intent
    const _config = { selfDeafen: this.selfDeafen, selfMute: this.selfMute };
    void _config;
    // Voice connection is handled by VoiceForwarder in Manager
    // This just marks the player as ready to receive voice state updates
  }

  /**
   * Disconnect from the voice channel
   */
  public async disconnect(): Promise<void> {
    this.connected = false;
    this.clearPositionUpdate();
    this.eventEmitter.emit('debug', `Player disconnected from guild ${this.guildId}`);
  }

  /**
   * Destroy the player and clean up resources
   */
  public async destroy(): Promise<void> {
    await this.stop();
    await this.disconnect();
    await this.node.destroyPlayer(this.guildId);
    this.eventEmitter.emit('playerDestroy', this);
  }

  // ==================== Playback Control ====================

  /**
   * Play a track
   */
  public async play(track?: Track, options?: { startTime?: number; endTime?: number; noReplace?: boolean }): Promise<void> {
    const trackToPlay = track || this.queue.shift();
    
    if (!trackToPlay) {
      throw new Error('No track provided and queue is empty');
    }

    this.track = trackToPlay;

    await this.node.updatePlayer(
      this.guildId,
      {
        encodedTrack: trackToPlay.encoded,
        position: options?.startTime,
        endTime: options?.endTime,
      },
      options?.noReplace ?? false
    );

    this.startPositionUpdate();
    this.eventEmitter.emit('debug', `Playing track: ${trackToPlay.info.title}`);
  }

  /**
   * Pause playback
   */
  public async pause(pause: boolean = true): Promise<void> {
    await this.node.updatePlayer(this.guildId, { paused: pause });
    this.paused = pause;
    this.eventEmitter.emit('debug', `Player ${pause ? 'paused' : 'resumed'}`);
  }

  /**
   * Resume playback
   */
  public async resume(): Promise<void> {
    await this.pause(false);
  }

  /**
   * Stop playback
   */
  public async stop(): Promise<void> {
    await this.node.updatePlayer(this.guildId, { encodedTrack: null });
    this.track = null;
    this.position = 0;
    this.clearPositionUpdate();
    this.eventEmitter.emit('debug', 'Player stopped');
  }

  /**
   * Seek to a position in the current track
   */
  public async seek(position: number): Promise<void> {
    if (!this.track) {
      throw new Error('No track is currently playing');
    }

    if (position < 0 || position > this.track.info.length) {
      throw new Error('Position out of bounds');
    }

    await this.node.updatePlayer(this.guildId, { position });
    this.position = position;
    this.eventEmitter.emit('debug', `Seeked to position: ${position}ms`);
  }

  /**
   * Set the volume (0-100)
   */
  public async setVolume(volume: number): Promise<void> {
    if (volume < 0 || volume > 100) {
      throw new Error('Volume must be between 0 and 100');
    }

    // Lavalink v4 accepts volume as 0-1000, but we expose 0-100 for better UX
    const lavalinkVolume = Math.floor(volume * 10);
    await this.node.updatePlayer(this.guildId, { volume: lavalinkVolume });
    this.volume = volume;
    this.eventEmitter.emit('debug', `Volume set to: ${volume}%`);
  }

  // ==================== Filter Management ====================

  /**
   * Get the filter builder for chainable filter configuration
   */
  public filters(): FilterBuilder {
    return this.filterBuilder;
  }

  /**
   * Set filters directly
   */
  public async setFilters(filters: FilterOptions): Promise<void> {
    await this.node.updatePlayer(this.guildId, { filters });
    this.eventEmitter.emit('debug', 'Filters updated');
  }

  /**
   * Clear all filters
   */
  public async clearFilters(): Promise<void> {
    await this.setFilters({});
    this.filterBuilder.clear();
    this.eventEmitter.emit('debug', 'Filters cleared');
  }

  // ==================== Queue Management ====================

  /**
   * Add a track to the queue
   */
  public addTrack(track: Track): void {
    this.queue.push(track);
  }

  /**
   * Add multiple tracks to the queue
   */
  public addTracks(tracks: Track[]): void {
    this.queue.push(...tracks);
  }

  /**
   * Remove a track from the queue by index
   */
  public removeTrack(index: number): Track | undefined {
    if (index < 0 || index >= this.queue.length) {
      return undefined;
    }
    return this.queue.splice(index, 1)[0];
  }

  /**
   * Clear the queue
   */
  public clearQueue(): void {
    this.queue = [];
  }

  /**
   * Set loop mode
   */
  public setLoopMode(mode: 'off' | 'track' | 'queue'): void {
    this.loopMode = mode;
    this.eventEmitter.emit('debug', `Loop mode set to: ${mode}`);
  }

  /**
   * Get playback history
   */
  public getHistory(): Track[] {
    return [...this.history];
  }

  /**
   * Clear playback history
   */
  public clearHistory(): void {
    this.history = [];
  }

  /**
   * Set crossfade duration
   */
  public setCrossfade(duration: number): void {
    this.crossfadeDuration = Math.max(0, duration);
    this.eventEmitter.emit('debug', `Crossfade duration set to: ${duration}ms`);
  }

  /**
   * Enable/disable volume normalization
   */
  public setVolumeNormalization(enabled: boolean): void {
    this.volumeNormalization = enabled;
    this.eventEmitter.emit('debug', `Volume normalization ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set playback speed (independent of pitch)
   */
  public async setSpeed(speed: number): Promise<void> {
    if (speed < 0.25 || speed > 3.0) {
      throw new Error('Speed must be between 0.25 and 3.0');
    }
    await this.node.updatePlayer(this.guildId, {
      filters: { timescale: { speed, pitch: 1.0, rate: 1.0 } }
    });
    this.eventEmitter.emit('debug', `Speed set to: ${speed}x`);
  }

  /**
   * Set playback pitch (independent of speed)
   */
  public async setPitch(pitch: number): Promise<void> {
    if (pitch < 0.25 || pitch > 3.0) {
      throw new Error('Pitch must be between 0.25 and 3.0');
    }
    await this.node.updatePlayer(this.guildId, {
      filters: { timescale: { speed: 1.0, pitch, rate: 1.0 } }
    });
    this.eventEmitter.emit('debug', `Pitch set to: ${pitch}x`);
  }

  /**
   * Set both speed and pitch
   */
  public async setSpeedAndPitch(speed: number, pitch: number): Promise<void> {
    if (speed < 0.25 || speed > 3.0 || pitch < 0.25 || pitch > 3.0) {
      throw new Error('Speed and pitch must be between 0.25 and 3.0');
    }
    await this.node.updatePlayer(this.guildId, {
      filters: { timescale: { speed, pitch, rate: 1.0 } }
    });
    this.eventEmitter.emit('debug', `Speed set to: ${speed}x, Pitch set to: ${pitch}x`);
  }

  /**
   * Save queue to JSON for persistence
   */
  public saveQueue(): string {
    return JSON.stringify({
      queue: this.queue,
      currentTrack: this.track,
      position: this.position,
      volume: this.volume,
      loopMode: this.loopMode,
      paused: this.paused,
    });
  }

  /**
   * Restore queue from JSON
   */
  public async restoreQueue(data: string): Promise<void> {
    try {
      const saved = JSON.parse(data);
      this.queue = saved.queue || [];
      this.loopMode = saved.loopMode || 'off';
      
      if (saved.volume !== undefined) {
        await this.setVolume(saved.volume);
      }
      
      if (saved.currentTrack) {
        await this.play(saved.currentTrack, { startTime: saved.position || 0 });
        if (saved.paused) {
          await this.pause();
        }
      }
      
      this.eventEmitter.emit('debug', 'Queue restored from save');
    } catch (error) {
      throw new Error(`Failed to restore queue: ${error}`);
    }
  }

  /**
   * Shuffle the queue
   */
  public shuffleQueue(): void {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
  }

  /**
   * Skip to the next track in the queue
   */
  public async skip(): Promise<boolean> {
    if (this.queue.length === 0) {
      await this.stop();
      return false;
    }

    await this.play();
    return true;
  }

  /**
   * Play the previous track
   */
  public async previous(): Promise<boolean> {
    if (this.previousTracks.length === 0) {
      return false;
    }

    const previousTrack = this.previousTracks.pop()!;
    if (this.track) {
      this.queue.unshift(this.track);
    }
    await this.play(previousTrack);
    return true;
  }

  // ==================== Search & Load ====================

  /**
   * Search for tracks
   */
  public async search(
    query: string,
    platform?: SearchPlatformType
  ): Promise<LoadResult> {
    // If query is a URL, don't add search prefix
    const isUrl = /^https?:\/\//.test(query);
    const searchPlatform = platform ?? this.defaultSearchPlatform;
    const identifier = isUrl ? query : `${searchPlatform}:${query}`;
    this.eventEmitter.emit('debug', `Searching: ${identifier}`);
    return this.node.loadTracks(identifier);
  }

  /**
   * Load tracks from a URL or search query
   */
  public async load(identifier: string): Promise<LoadResult> {
    return this.node.loadTracks(identifier);
  }

  // ==================== Voice State Management ====================

  /**
   * Update voice state (called by VoiceForwarder)
   */
  public async updateVoiceState(state: Partial<VoiceState>): Promise<void> {
    this.voiceState = { ...this.voiceState, ...state };

    // If we have complete voice state, update the player
    if (
      this.voiceState.token &&
      this.voiceState.endpoint &&
      this.voiceState.sessionId
    ) {
      await this.node.updatePlayer(this.guildId, {
        voice: this.voiceState as VoiceState,
      });
      this.connected = true;
      this.eventEmitter.emit('debug', `Voice state updated for guild ${this.guildId}`);
    }
  }

  // ==================== State Management ====================

  /**
   * Update player state from PlayerUpdateEvent
   */
  public updateState(state: PlayerState): void {
    this.position = state.position;
    this.connected = state.connected;
    this.ping = state.ping;
  }

  /**
   * Get current player state
   */
  public getState(): PlayerState {
    return {
      volume: this.volume,
      paused: this.paused,
      position: this.position,
      connected: this.connected,
      ping: this.ping,
    };
  }

  /**
   * Check if player is playing
   */
  public isPlaying(): boolean {
    return this.track !== null && !this.paused;
  }

  /**
   * Get total queue duration
   */
  public getQueueDuration(): number {
    return this.queue.reduce((total, track) => total + track.info.length, 0);
  }

  /**
   * Move track in queue
   */
  public moveTrack(from: number, to: number): boolean {
    if (from < 0 || from >= this.queue.length || to < 0 || to >= this.queue.length) {
      return false;
    }

    const [track] = this.queue.splice(from, 1);
    this.queue.splice(to, 0, track);
    return true;
  }

  // ==================== Internal Methods ====================

  /**
   * Start position update interval
   */
  private startPositionUpdate(): void {
    this.clearPositionUpdate();
    this.positionUpdateInterval = setInterval(() => {
      if (this.isPlaying() && this.track) {
        this.position += 1000;
        // Clamp position to track length
        if (this.position > this.track.info.length) {
          this.position = this.track.info.length;
        }
      }
    }, 1000);
  }

  /**
   * Clear position update interval
   */
  private clearPositionUpdate(): void {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  /**
   * Handle track end (called by Manager)
   */
  public async handleTrackEnd(reason: string): Promise<void> {
    if (this.track) {
      // Add to history
      this.history.push(this.track);
      if (this.history.length > this.historyMaxSize) {
        this.history.shift();
      }
      
      this.previousTracks.push(this.track);
      // Keep only last 10 previous tracks
      if (this.previousTracks.length > 10) {
        this.previousTracks.shift();
      }
    }

    const previousTrack = this.track;

    // Debug logging
    this.eventEmitter.emit('debug', `Track ended: reason=${reason}, loopMode=${this.loopMode}, autoPlay=${this.autoPlay}, queueLength=${this.queue.length}`);

    // Handle loop modes
    if (reason === 'finished' && this.loopMode === 'track' && previousTrack) {
      this.eventEmitter.emit('debug', 'Looping current track');
      await this.play(previousTrack);
      return;
    }

    if (reason === 'finished' && this.loopMode === 'queue' && previousTrack) {
      // Add current track back to end of queue
      this.queue.push(previousTrack);
    }

    this.track = null;
    this.position = 0;
    this.clearPositionUpdate();

    // Auto-play next track from queue if available
    if (reason === 'finished' && this.queue.length > 0) {
      this.eventEmitter.emit('debug', 'Playing next track from queue');
      await this.play();
      return;
    }

    // If queue is empty and autoPlay is enabled, try to find related tracks
    if (this.autoPlay && reason === 'finished' && this.queue.length === 0 && previousTrack) {
      this.eventEmitter.emit('debug', 'Queue empty, attempting AutoPlay...');
      try {
        const success = await this.autoPlayEngine.execute(this, previousTrack);
        if (success) {
          this.eventEmitter.emit('debug', 'AutoPlay succeeded, continuing playback');
          return; // AutoPlay added a track and started playing
        }
        this.eventEmitter.emit('debug', 'AutoPlay failed to find related tracks');
      } catch (error) {
        this.eventEmitter.emit('debug', `AutoPlay error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Only emit queueEnd if queue is still empty after AutoPlay attempt
    if (this.queue.length === 0 && !this.track) {
      this.eventEmitter.emit('debug', 'Queue is empty, emitting queueEnd');
      this.eventEmitter.emit('queueEnd', this);
    }
  }
}
