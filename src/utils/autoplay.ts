/**
 * AutoPlay - Intelligent track recommendations based on previous track
 * Fetches related tracks from YouTube, SoundCloud, or Spotify when queue ends
 */

import type { Player } from '../player/Player';
import type { Track } from '../types/lavalink';

export class AutoPlay {
  private playedIdentifiers: Set<string> = new Set();
  private maxHistorySize: number = 50;

  /**
   * Attempt to find and play a related track based on the previous track
   */
  public async execute(player: Player, previousTrack: Track): Promise<boolean> {
    if (!previousTrack) {
      player['eventEmitter'].emit('debug', '[AutoPlay] No previous track provided');
      return false;
    }

    // Check if node is connected
    if (!player.node.isConnected()) {
      player['eventEmitter'].emit('debug', '[AutoPlay] Node not connected, aborting');
      return false;
    }

    const sourceName = previousTrack.info.sourceName;
    const identifier = previousTrack.info.identifier || previousTrack.info.uri;

    // Add to played history
    if (identifier) {
      this.playedIdentifiers.add(identifier);
      if (this.playedIdentifiers.size > this.maxHistorySize) {
        const firstItem = this.playedIdentifiers.values().next().value;
        if (firstItem) {
          this.playedIdentifiers.delete(firstItem);
        }
      }
    }

    player['eventEmitter'].emit('debug', `[AutoPlay] Initiated for ${sourceName}: ${previousTrack.info.title}`);

    try {
      switch (sourceName) {
        case 'youtube':
          return await this.handleYouTube(player, previousTrack);
        case 'soundcloud':
          return await this.handleSoundCloud(player, previousTrack);
        case 'spotify':
          return await this.handleSpotify(player, previousTrack);
        default:
          return await this.handleYouTube(player, previousTrack); // Fallback to YouTube
      }
    } catch (error) {
      player['eventEmitter'].emit('debug', `[AutoPlay] Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * YouTube AutoPlay - Uses YouTube's RD (Radio/Recommendations) playlist
   */
  private async handleYouTube(player: Player, previousTrack: Track): Promise<boolean> {
    const identifier = previousTrack.info.identifier;
    if (!identifier) {
      player['eventEmitter'].emit('debug', '[AutoPlay] No identifier found for YouTube track');
      return false;
    }

    // YouTube's RD playlist URL for recommendations
    const rdUrl = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
    player['eventEmitter'].emit('debug', `[AutoPlay] Searching YouTube RD: ${rdUrl}`);
    
    const result = await player.search(rdUrl, 'ytsearch');
    player['eventEmitter'].emit('debug', `[AutoPlay] Search result type: ${result.loadType}`);

    if (result.loadType === 'error' || result.loadType === 'empty') {
      player['eventEmitter'].emit('debug', `[AutoPlay] YouTube search failed: ${result.loadType}`);
      return false;
    }

    let tracks: Track[] = [];
    if (result.loadType === 'playlist') {
      tracks = result.data.tracks;
    } else if (result.loadType === 'search') {
      tracks = result.data;
    } else if (result.loadType === 'track') {
      tracks = [result.data];
    }

    player['eventEmitter'].emit('debug', `[AutoPlay] Found ${tracks.length} tracks`);

    // Filter out already played tracks
    let availableTracks = tracks.filter(track => {
      const trackId = track.info.identifier || track.info.uri;
      return trackId && !this.playedIdentifiers.has(trackId);
    });

    // If all tracks have been played, reset and use all tracks
    if (availableTracks.length === 0) {
      availableTracks = tracks;
      player['eventEmitter'].emit('debug', '[AutoPlay] All tracks played, resetting filter');
    }

    if (availableTracks.length === 0) {
      player['eventEmitter'].emit('debug', '[AutoPlay] No available tracks after filtering');
      return false;
    }

    // Pick a random track
    const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
    
    if (!randomTrack) {
      player['eventEmitter'].emit('debug', '[AutoPlay] Failed to select random track');
      return false;
    }
    
    player.addTrack(randomTrack);
    player['eventEmitter'].emit('debug', `[AutoPlay] Track added to queue: ${randomTrack.info.title}, queue length: ${player.queue.length}`);
    
    await player.play();
    
    player['eventEmitter'].emit('debug', `[AutoPlay] Added YouTube track: ${randomTrack.info.title}`);
    return true;
  }

  /**
   * SoundCloud AutoPlay - Uses SoundCloud's related tracks
   */
  private async handleSoundCloud(player: Player, previousTrack: Track): Promise<boolean> {
    const uri = previousTrack.info.uri;
    if (!uri) return false;

    // Search for related SoundCloud tracks
    const query = `${previousTrack.info.title} ${previousTrack.info.author}`;
    const result = await player.search(query, 'scsearch');

    if (result.loadType === 'error' || result.loadType === 'empty') {
      return false;
    }

    let tracks: Track[] = [];
    if (result.loadType === 'search') {
      tracks = result.data;
    } else if (result.loadType === 'track') {
      tracks = [result.data];
    }

    // Filter out already played tracks
    let availableTracks = tracks.filter(track => {
      const trackId = track.info.identifier || track.info.uri;
      return trackId && !this.playedIdentifiers.has(trackId);
    });

    if (availableTracks.length === 0) {
      availableTracks = tracks;
    }

    if (availableTracks.length === 0) {
      return false;
    }

    const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
    
    if (!randomTrack) {
      player['eventEmitter'].emit('debug', '[AutoPlay] Failed to select random SoundCloud track');
      return false;
    }
    
    player.addTrack(randomTrack);
    player['eventEmitter'].emit('debug', `[AutoPlay] Track added to queue: ${randomTrack.info.title}, queue length: ${player.queue.length}`);
    
    await player.play();
    
    player['eventEmitter'].emit('debug', `[AutoPlay] Added SoundCloud track: ${randomTrack.info.title}`);
    return true;
  }

  /**
   * Spotify AutoPlay - Use Spotify recommendations API
   */
  private async handleSpotify(player: Player, previousTrack: Track): Promise<boolean> {
    const identifier = previousTrack.info.identifier;

    if (!identifier) {
      player['eventEmitter'].emit('debug', '[AutoPlay] Missing identifier for Spotify track');
      return false;
    }

    // Try using Spotify recommendations endpoint (sprec:)
    player['eventEmitter'].emit('debug', `[AutoPlay] Getting Spotify recommendations for: ${identifier}`);
    const recResult = await player.search(`sprec:${identifier}`, 'spsearch');

    if (recResult.loadType === 'error' || recResult.loadType === 'empty') {
      player['eventEmitter'].emit('debug', '[AutoPlay] Spotify recommendations failed, falling back to artist search');
      // Fallback to artist search
      return this.handleSpotifyArtistFallback(player, previousTrack);
    }

    let tracks: Track[] = [];
    if (recResult.loadType === 'playlist') {
      tracks = recResult.data.tracks;
    } else if (recResult.loadType === 'search') {
      tracks = recResult.data;
    } else if (recResult.loadType === 'track') {
      tracks = [recResult.data];
    }

    if (!tracks.length) {
      player['eventEmitter'].emit('debug', '[AutoPlay] No recommendations found, falling back to artist search');
      return this.handleSpotifyArtistFallback(player, previousTrack);
    }

    // Filter out previously played tracks
    let available = tracks.filter(t => {
      const id = t.info.identifier || t.info.uri;
      return id && !this.playedIdentifiers.has(id);
    });

    if (!available.length) {
      available = tracks;
      player['eventEmitter'].emit('debug', '[AutoPlay] All recommendations played, resetting filter');
    }

    if (!available.length) {
      return false;
    }

    // Pick a random recommended track
    const randomTrack = available[Math.floor(Math.random() * available.length)];

    if (!randomTrack) {
      player['eventEmitter'].emit('debug', '[AutoPlay] Failed to select random Spotify track');
      return false;
    }

    player.addTrack(randomTrack);
    player['eventEmitter'].emit('debug', `[AutoPlay] Track added to queue: ${randomTrack.info.title}, queue length: ${player.queue.length}`);
    
    await player.play();

    player['eventEmitter'].emit(
      'debug',
      `[AutoPlay] Added Spotify recommended track: ${randomTrack.info.title}`
    );

    return true;
  }

  /**
   * Fallback: Search for artist tracks when recommendations fail
   */
  private async handleSpotifyArtistFallback(player: Player, previousTrack: Track): Promise<boolean> {
    const artist = previousTrack.info.author;

    if (!artist) {
      return false;
    }

    const artistResult = await player.search(`${artist}`, 'spsearch');

    if (artistResult.loadType === 'empty' || artistResult.loadType === 'error') {
      return false;
    }

    let artistTracks: Track[] = [];

    if (artistResult.loadType === 'search') {
      artistTracks = artistResult.data;
    } else if (artistResult.loadType === 'track') {
      artistTracks = [artistResult.data];
    }

    if (!artistTracks.length) {
      return false;
    }

    let available = artistTracks.filter(t => {
      const id = t.info.identifier || t.info.uri;
      return id && !this.playedIdentifiers.has(id);
    });

    if (!available.length) {
      available = artistTracks;
    }

    if (!available.length) {
      return false;
    }

    const randomTrack = available[Math.floor(Math.random() * available.length)];

    if (!randomTrack) {
      player['eventEmitter'].emit('debug', '[AutoPlay] Failed to select random artist track');
      return false;
    }

    player.addTrack(randomTrack);
    player['eventEmitter'].emit('debug', `[AutoPlay] Track added to queue: ${randomTrack.info.title}, queue length: ${player.queue.length}`);
    
    await player.play();

    player['eventEmitter'].emit(
      'debug',
      `[AutoPlay] Added Spotify artist track (fallback): ${randomTrack.info.title}`
    );

    return true;
  }

  /**
   * Clear played history
   */
  public clearHistory(): void {
    this.playedIdentifiers.clear();
  }

  /**
   * Get played history size
   */
  public getHistorySize(): number {
    return this.playedIdentifiers.size;
  }
}
