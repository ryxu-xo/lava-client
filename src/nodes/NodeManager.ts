/**
 * NodeManager - Singleton pattern for managing multiple Lavalink nodes
 * Implements penalty-based load balancing and automatic failover
 */

import { Node } from './Node';
import type { NodeOptions } from '../types/lavalink';
import type { LavalinkEventEmitter } from '../manager/events';

export type PenaltyCalculator = (node: Node) => number;

export class NodeManager {
  private static instance: NodeManager | null = null;

  private nodes: Map<string, Node> = new Map();
  private clientId: string | null = null;
  private eventEmitter: LavalinkEventEmitter | null = null;
  private customPenaltyCalculator: PenaltyCalculator | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): NodeManager {
    if (!NodeManager.instance) {
      NodeManager.instance = new NodeManager();
    }
    return NodeManager.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    if (NodeManager.instance) {
      NodeManager.instance.disconnectAll();
      NodeManager.instance = null;
    }
  }

  /**
   * Initialize the node manager
   */
  public init(clientId: string, eventEmitter: LavalinkEventEmitter): void {
    this.clientId = clientId;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Add a node to the manager
   */
  public async addNode(options: NodeOptions): Promise<Node> {
    if (this.nodes.has(options.name)) {
      throw new Error(`Node with name ${options.name} already exists`);
    }

    if (!this.clientId) {
      throw new Error('NodeManager not initialized. Call init() first.');
    }

    const node = new Node(options);
    this.setupNodeEventHandlers(node);
    this.nodes.set(options.name, node);

    try {
      await node.connect(this.clientId);
      return node;
    } catch (error) {
      this.nodes.delete(options.name);
      throw error;
    }
  }

  /**
   * Remove a node from the manager
   */
  public removeNode(name: string): boolean {
    const node = this.nodes.get(name);
    if (!node) {
      return false;
    }

    node.disconnect();
    this.nodes.delete(name);
    return true;
  }

  /**
   * Get a node by name
   */
  public getNode(name: string): Node | undefined {
    return this.nodes.get(name);
  }

  /**
   * Get all nodes
   */
  public getNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all connected nodes
   */
  public getConnectedNodes(): Node[] {
    return this.getNodes().filter((node) => node.isConnected());
  }

  /**
   * Get the best node based on penalty calculation
   * This is the core load balancing logic
   */
  public getBestNode(): Node {
    const connectedNodes = this.getConnectedNodes();

    if (connectedNodes.length === 0) {
      throw new Error('No connected nodes available');
    }

    // Use custom penalty calculator if provided
    const penaltyFn = this.customPenaltyCalculator || ((node: Node) => node.getPenalty());

    // Find node with lowest penalty
    let bestNode = connectedNodes[0];
    let lowestPenalty = penaltyFn(bestNode);

    for (let i = 1; i < connectedNodes.length; i++) {
      const node = connectedNodes[i];
      const penalty = penaltyFn(node);

      if (penalty < lowestPenalty) {
        lowestPenalty = penalty;
        bestNode = node;
      }
    }

    return bestNode;
  }

  /**
   * Get node penalties for all connected nodes
   */
  public getNodePenalties(): Map<string, number> {
    const penalties = new Map<string, number>();
    const penaltyFn = this.customPenaltyCalculator || ((node: Node) => node.getPenalty());

    for (const [name, node] of this.nodes) {
      if (node.isConnected()) {
        penalties.set(name, penaltyFn(node));
      } else {
        penalties.set(name, Infinity);
      }
    }

    return penalties;
  }

  /**
   * Get detailed penalty breakdown for all nodes
   */
  public getNodePenaltyDetails(): Map<
    string,
    ReturnType<Node['getPenaltyDetails']>
  > {
    const details = new Map<string, ReturnType<Node['getPenaltyDetails']>>();

    for (const [name, node] of this.nodes) {
      details.set(name, node.getPenaltyDetails());
    }

    return details;
  }

  /**
   * Set a custom penalty calculator
   * Allows users to implement their own load balancing logic
   */
  public setPenaltyCalculator(calculator: PenaltyCalculator): void {
    this.customPenaltyCalculator = calculator;
  }

  /**
   * Reset to default penalty calculator
   */
  public resetPenaltyCalculator(): void {
    this.customPenaltyCalculator = null;
  }

  /**
   * Disconnect all nodes
   */
  public disconnectAll(): void {
    for (const node of this.nodes.values()) {
      node.disconnect();
    }
    this.nodes.clear();
  }

  /**
   * Get aggregate stats from all nodes
   */
  public getAggregateStats(): {
    totalNodes: number;
    connectedNodes: number;
    totalPlayers: number;
    totalPlayingPlayers: number;
    averageCpuLoad: number;
    totalMemoryUsed: number;
    totalMemoryAllocated: number;
  } {
    const connectedNodes = this.getConnectedNodes();
    let totalPlayers = 0;
    let totalPlayingPlayers = 0;
    let totalCpuLoad = 0;
    let totalMemoryUsed = 0;
    let totalMemoryAllocated = 0;

    for (const node of connectedNodes) {
      if (node.stats) {
        totalPlayers += node.stats.players;
        totalPlayingPlayers += node.stats.playingPlayers;
        totalCpuLoad += node.stats.cpu.lavalinkLoad;
        totalMemoryUsed += node.stats.memory.used;
        totalMemoryAllocated += node.stats.memory.allocated;
      }
    }

    return {
      totalNodes: this.nodes.size,
      connectedNodes: connectedNodes.length,
      totalPlayers,
      totalPlayingPlayers,
      averageCpuLoad: connectedNodes.length > 0 ? totalCpuLoad / connectedNodes.length : 0,
      totalMemoryUsed,
      totalMemoryAllocated,
    };
  }

  /**
   * Health check for all nodes
   */
  public async healthCheck(): Promise<Map<string, boolean>> {
    const health = new Map<string, boolean>();

    for (const [name, node] of this.nodes) {
      try {
        if (node.isConnected()) {
          // Try to fetch stats as a health check
          await node.getStats();
          health.set(name, true);
        } else {
          health.set(name, false);
        }
      } catch (error) {
        health.set(name, false);
      }
    }

    return health;
  }

  // ==================== Private Methods ====================

  /**
   * Setup event handlers for a node
   */
  private setupNodeEventHandlers(node: Node): void {
    if (!this.eventEmitter) {
      return;
    }

    node.on('onConnect', () => {
      this.eventEmitter!.emit('nodeConnect', node);
      this.eventEmitter!.emit('debug', `Node ${node.options.name} connected`);
    });

    node.on('onDisconnect', (code, reason) => {
      this.eventEmitter!.emit('nodeDisconnect', node, code, reason);
      this.eventEmitter!.emit(
        'debug',
        `Node ${node.options.name} disconnected: ${code} - ${reason}`
      );
    });

    node.on('onError', (error) => {
      this.eventEmitter!.emit('nodeError', node, error);
      this.eventEmitter!.emit(
        'debug',
        `Node ${node.options.name} error: ${error.message}`
      );
    });

    node.on('onReconnecting', (attempt) => {
      this.eventEmitter!.emit('nodeReconnect', node, attempt);
      this.eventEmitter!.emit(
        'debug',
        `Node ${node.options.name} reconnecting (attempt ${attempt})`
      );
    });

    node.on('onStats', (stats) => {
      this.eventEmitter!.emit('nodeStats', node, stats);
    });

    node.on('onReady', (sessionId, resumed) => {
      this.eventEmitter!.emit(
        'debug',
        `Node ${node.options.name} ready (session: ${sessionId}, resumed: ${resumed})`
      );
    });
  }
}

/**
 * Helper function to get the singleton instance
 */
export function getNodeManager(): NodeManager {
  return NodeManager.getInstance();
}
