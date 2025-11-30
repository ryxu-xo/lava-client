/**
 * Manager - High-level API for the Lavalink client library
 * Provides convenient methods for managing players, nodes, and voice connections
 */

import { LavalinkEventEmitter } from './events';
import { VoiceForwarder } from './VoiceForwarder';
import { NodeManager } from '../nodes/NodeManager';
import { Player } from '../player/Player';
import type { Node } from '../nodes/Node';
import type {
  ManagerOptions,
  PlayerOptions,
  DiscordVoiceEvent,
  NodeOptions,
  SearchPlatformType,
  LoadResult,
} from '../types/lavalink';

export class Manager extends LavalinkEventEmitter {
  public readonly options: Required<ManagerOptions>;
  private nodeManager: NodeManager;
  private voiceForwarder: VoiceForwarder | null = null;
  private players: Map<string, Player> = new Map();
  private clientId: string | null = null;
  private initialized: boolean = false;

  constructor(options: ManagerOptions) {
    super();

    this.options = {
      nodes: options.nodes,
      send: options.send,
      clientId: options.clientId ?? '',
      shards: options.shards ?? 1,
      autoPlay: options.autoPlay ?? true,
      defaultSearchPlatform: options.defaultSearchPlatform ?? 'ytsearch',
    };

    this.nodeManager = NodeManager.getInstance();
  }

  /**
   * Initialize the manager
   * Must be called before using the manager
   */
  public async init(clientId?: string): Promise<void> {
    if (this.initialized) {
      throw new Error('Manager already initialized');
    }

    this.clientId = clientId ?? this.options.clientId;
    if (!this.clientId) {
      throw new Error('Client ID is required');
    }

    // Initialize node manager
    this.nodeManager.init(this.clientId, this);

    // Initialize voice forwarder
    this.voiceForwarder = new VoiceForwarder(
      this.clientId,
      this.options.send,
      this
    );

    // Mark as initialized before adding nodes
    this.initialized = true;

    // Add all configured nodes
    for (const nodeOptions of this.options.nodes) {
      try {
        await this.addNode(nodeOptions);
      } catch (error) {
        this.emit('debug', `Failed to connect to node ${nodeOptions.name}: ${error}`);
        this.emit('nodeError', this.nodeManager.getNode(nodeOptions.name)!, error as Error);
      }
    }

    this.emit('debug', 'Manager initialized');
  }

  /**
   * Check if manager is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  // ==================== Node Management ====================

  /**
   * Add a node
   */
  public async addNode(options: NodeOptions): Promise<Node> {
    if (!this.initialized) {
      throw new Error('Manager not initialized');
    }

    const node = await this.nodeManager.addNode(options);
    this.setupNodeEventHandlers(node);
    return node;
  }

  /**
   * Remove a node
   */
  public removeNode(name: string): boolean {
    return this.nodeManager.removeNode(name);
  }

  /**
   * Get a node by name
   */
  public getNode(name: string): Node | undefined {
    return this.nodeManager.getNode(name);
  }

  /**
   * Get all nodes
   */
  public getNodes(): Node[] {
    return this.nodeManager.getNodes();
  }

  /**
   * Get the best available node
   */
  public getBestNode(): Node {
    return this.nodeManager.getBestNode();
  }

  // ==================== Player Management ====================

  /**
   * Create a player for a guild
   */
  public create(options: PlayerOptions): Player {
    if (!this.initialized) {
      throw new Error('Manager not initialized');
    }

    if (this.players.has(options.guildId)) {
      return this.players.get(options.guildId)!;
    }

    const node = this.getBestNode();
    const player = new Player(options, node, this, this.options.autoPlay);

    this.players.set(options.guildId, player);
    this.emit('playerCreate', player);

    // Send voice state update to Discord
    this.voiceForwarder!.sendVoiceUpdate(
      options.guildId,
      options.voiceChannelId,
      {
        selfMute: options.selfMute,
        selfDeaf: options.selfDeafen,
      }
    );

    return player;
  }

  /**
   * Get a player by guild ID
   */
  public get(guildId: string): Player | undefined {
    return this.players.get(guildId);
  }

  /**
   * Destroy a player
   */
  public async destroyPlayer(guildId: string): Promise<boolean> {
    const player = this.players.get(guildId);
    if (!player) {
      return false;
    }

    await player.destroy();
    this.players.delete(guildId);

    // Send voice state update to leave the channel
    this.voiceForwarder!.sendVoiceUpdate(guildId, null);
    this.voiceForwarder!.clearVoiceState(guildId);

    return true;
  }

  /**
   * Get all players
   */
  public getPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  /**
   * Check if a player exists for a guild
   */
  public has(guildId: string): boolean {
    return this.players.has(guildId);
  }

  // ==================== Voice Management ====================

  /**
   * Update voice state from Discord events
   * Call this from your Discord client's raw event handler
   */
  public updateVoiceState(packet: DiscordVoiceEvent | any): void {
    if (!this.voiceForwarder) {
      throw new Error('Manager not initialized');
    }

    // Handle both typed packets and raw Discord.js packets
    if (!packet.t || !packet.d) {
      return;
    }

    const eventType = packet.t;
    if (eventType !== 'VOICE_SERVER_UPDATE' && eventType !== 'VOICE_STATE_UPDATE') {
      return;
    }

    const guildId = packet.d.guild_id;
    const player = this.players.get(guildId);

    this.voiceForwarder.handleVoiceUpdate(packet, player);
  }

  // ==================== Convenience Methods ====================

  /**
   * Search for tracks using the default search platform
   */
  public async search(
    query: string,
    platform?: SearchPlatformType
  ): Promise<LoadResult> {
    const node = this.getBestNode();
    const searchPlatform = platform ?? this.options.defaultSearchPlatform;

    // If query is a URL, don't add search prefix
    const isUrl = /^https?:\/\//.test(query);
    const identifier = isUrl ? query : `${searchPlatform}:${query}`;

    return node.loadTracks(identifier);
  }

  /**
   * Load tracks from a URL or identifier
   */
  public async load(identifier: string): Promise<LoadResult> {
    const node = this.getBestNode();
    return node.loadTracks(identifier);
  }

  /**
   * Decode a track
   */
  public async decodeTrack(encoded: string): Promise<any> {
    const node = this.getBestNode();
    return node.decodeTrack(encoded);
  }

  /**
   * Decode multiple tracks
   */
  public async decodeTracks(encoded: string[]): Promise<any[]> {
    const node = this.getBestNode();
    return node.decodeTracks(encoded);
  }

  // ==================== Statistics ====================

  /**
   * Get aggregate statistics from all nodes
   */
  public getStats(): ReturnType<NodeManager['getAggregateStats']> {
    return this.nodeManager.getAggregateStats();
  }

  /**
   * Get node penalties for load balancing inspection
   */
  public getNodePenalties(): Map<string, number> {
    return this.nodeManager.getNodePenalties();
  }

  /**
   * Get detailed penalty breakdown for all nodes
   */
  public getNodePenaltyDetails(): Map<string, any> {
    return this.nodeManager.getNodePenaltyDetails();
  }

  /**
   * Perform health check on all nodes
   */
  public async healthCheck(): Promise<Map<string, boolean>> {
    return this.nodeManager.healthCheck();
  }

  // ==================== Cleanup ====================

  /**
   * Destroy all players and disconnect from all nodes
   */
  public async destroyAll(): Promise<void> {
    // Destroy all players
    for (const [guildId] of this.players) {
      await this.destroyPlayer(guildId);
    }

    // Disconnect all nodes
    this.nodeManager.disconnectAll();

    // Clear voice states
    this.voiceForwarder?.clearAllVoiceStates();

    this.initialized = false;
    this.emit('debug', 'Manager destroyed');
  }

  // ==================== Private Methods ====================

  /**
   * Setup event handlers for a node
   */
  private setupNodeEventHandlers(node: Node): void {
    node.on('onTrackStart', (event) => {
      const player = this.players.get(event.guildId);
      if (player) {
        this.emit('trackStart', player, event.track);
      }
    });

    node.on('onTrackEnd', (event) => {
      const player = this.players.get(event.guildId);
      if (player) {
        player.handleTrackEnd(event.reason).catch((error) => {
          this.emit('debug', `Error handling track end: ${error.message}`);
        });
        this.emit('trackEnd', player, event.track, event.reason);
      }
    });

    node.on('onTrackException', (event) => {
      const player = this.players.get(event.guildId);
      if (player) {
        this.emit('trackException', player, event.track, event.exception);
      }
    });

    node.on('onTrackStuck', (event) => {
      const player = this.players.get(event.guildId);
      if (player) {
        this.emit('trackStuck', player, event.track, event.thresholdMs);
      }
    });

    node.on('onWebSocketClosed', (event) => {
      const player = this.players.get(event.guildId);
      if (player) {
        this.emit('socketClosed', player, event.code, event.reason, event.byRemote);
      }
    });

    node.on('onPlayerUpdate', (guildId, state) => {
      const player = this.players.get(guildId);
      if (player) {
        player.updateState({
          volume: player.volume,
          paused: player.paused,
          position: state.position,
          connected: state.connected,
          ping: state.ping,
        });
      }
    });
  }
}
