# Advanced Usage Guide

This guide covers advanced features and patterns for using Lava.ts.

## Table of Contents

- [Custom Load Balancing](#custom-load-balancing)
- [Advanced Filter Configurations](#advanced-filter-configurations)
- [Queue Management](#queue-management)
- [Error Handling](#error-handling)
- [Custom Events](#custom-events)
- [Performance Optimization](#performance-optimization)

## Custom Load Balancing

Implement your own penalty calculation for custom load balancing strategies:

```typescript
import { Manager, NodeManager } from 'lava.ts';

const manager = new Manager({ /* ... */ });
const nodeManager = NodeManager.getInstance();

// Custom penalty calculator that prioritizes nodes in specific regions
nodeManager.setPenaltyCalculator((node) => {
  if (!node.isConnected() || !node.stats) {
    return Infinity;
  }

  let penalty = 0;

  // Base penalty from players
  penalty += node.stats.players * 10;
  penalty += node.stats.playingPlayers * 20;

  // CPU penalty (higher weight)
  const cpuPenalty = (node.stats.cpu.lavalinkLoad / node.stats.cpu.cores) * 150;
  penalty += cpuPenalty;

  // Memory penalty
  const memoryRatio = node.stats.memory.used / node.stats.memory.allocated;
  if (memoryRatio > 0.85) {
    penalty += (memoryRatio - 0.85) * 1000;
  }

  // Regional preference (if node name contains region)
  if (node.options.name.includes('US')) {
    penalty -= 50; // Prefer US nodes
  }

  return penalty;
});
```

## Advanced Filter Configurations

### Combining Multiple Filters

```typescript
const player = manager.get(guildId);

// Complex filter chain
await player.filters()
  .equalizer([
    { band: 0, gain: 0.25 },
    { band: 1, gain: 0.15 },
    { band: 2, gain: 0.1 },
  ])
  .timescale({ speed: 1.1, pitch: 1.0, rate: 1.0 })
  .tremolo({ frequency: 3.0, depth: 0.5 })
  .rotation({ rotationHz: 0.15 })
  .volume(0.8)
  .apply();
```

### Custom Equalizer Profiles

```typescript
import { FilterBuilder, EqualizerBand } from 'lava.ts';

// Create custom equalizer profile
const customEQ: EqualizerBand[] = [
  { band: 0, gain: 0.3 },   // 25 Hz
  { band: 1, gain: 0.2 },   // 40 Hz
  { band: 2, gain: 0.1 },   // 63 Hz
  { band: 3, gain: 0.0 },   // 100 Hz
  { band: 4, gain: -0.1 },  // 160 Hz
  { band: 5, gain: -0.1 },  // 250 Hz
  { band: 6, gain: 0.0 },   // 400 Hz
  { band: 7, gain: 0.1 },   // 630 Hz
  { band: 8, gain: 0.15 },  // 1 kHz
  { band: 9, gain: 0.2 },   // 1.6 kHz
  { band: 10, gain: 0.2 },  // 2.5 kHz
  { band: 11, gain: 0.15 }, // 4 kHz
  { band: 12, gain: 0.1 },  // 6.3 kHz
  { band: 13, gain: 0.0 },  // 10 kHz
  { band: 14, gain: -0.1 }, // 16 kHz
];

await player.filters().equalizer(customEQ).apply();
```

### Preset Switching

```typescript
// Save and restore filter configurations
const savedFilters = player.filters().getFilters();

// Apply different filters temporarily
await player.filters().nightcore().apply();

// Restore original filters
await player.filters().setFilters(savedFilters).apply();
```

## Queue Management

### Advanced Queue Operations

```typescript
const player = manager.get(guildId);

// Add multiple tracks
const result = await manager.search('playlist:https://...');
if (result.loadType === 'playlist') {
  player.addTracks(result.data.tracks);
}

// Shuffle queue
player.shuffleQueue();

// Move track to specific position
player.moveTrack(5, 0); // Move track at index 5 to front

// Get specific tracks
const nextTrack = player.queue[0];
const lastTrack = player.queue[player.queue.length - 1];

// Calculate total duration
const totalDuration = player.getQueueDuration();
console.log(`Queue duration: ${formatTime(totalDuration)}`);

// Advanced filtering
const shortTracks = player.queue.filter(track => track.info.length < 300000); // < 5 minutes
const longTracks = player.queue.filter(track => track.info.length > 600000); // > 10 minutes

// Sort queue by duration
player.queue.sort((a, b) => a.info.length - b.info.length);
```

### Loop Modes

Implement custom loop functionality:

```typescript
class LoopablePlayer extends Player {
  private loopMode: 'none' | 'track' | 'queue' = 'none';

  public setLoopMode(mode: 'none' | 'track' | 'queue'): void {
    this.loopMode = mode;
  }

  public async handleTrackEnd(reason: string): Promise<void> {
    if (reason === 'finished') {
      if (this.loopMode === 'track' && this.track) {
        // Replay current track
        await this.play(this.track);
        return;
      } else if (this.loopMode === 'queue' && this.track) {
        // Add current track to end of queue
        this.addTrack(this.track);
      }
    }

    await super.handleTrackEnd(reason);
  }
}
```

## Error Handling

### Comprehensive Error Handling

```typescript
import { Manager, Events } from 'lava.ts';

const manager = new Manager({ /* ... */ });

// Node errors
manager.on(Events.NodeError, (node, error) => {
  console.error(`Node ${node.options.name} error:`, error);
  
  // Log to monitoring service
  monitoring.logError('lavalink_node_error', {
    node: node.options.name,
    error: error.message,
    stack: error.stack,
  });

  // Attempt recovery
  if (error.message.includes('connection')) {
    // Connection errors are handled by automatic reconnection
  } else {
    // Other errors might need manual intervention
    notifyAdmin(`Node ${node.options.name} encountered error: ${error.message}`);
  }
});

// Track errors
manager.on(Events.TrackException, (player, track, exception) => {
  console.error(`Track exception for ${track.info.title}:`, exception);

  if (exception.severity === 'common') {
    // Common errors (e.g., video unavailable) - skip to next
    player.skip().catch(console.error);
  } else if (exception.severity === 'suspicious') {
    // Suspicious errors - might need investigation
    console.warn('Suspicious track error:', exception);
  } else if (exception.severity === 'fault') {
    // Fault errors - critical, might need restart
    console.error('Critical track fault:', exception);
  }
});

// Track stuck handling
manager.on(Events.TrackStuck, async (player, track, thresholdMs) => {
  console.warn(`Track stuck: ${track.info.title} (${thresholdMs}ms)`);
  
  // Attempt to skip
  await player.skip();
});

// Graceful error handling in commands
async function playCommand(query: string, guildId: string) {
  try {
    const player = manager.get(guildId) || manager.create({ /* ... */ });
    const result = await player.search(query);

    if (result.loadType === 'error') {
      throw new Error(`Search failed: ${result.data.message}`);
    }

    // Handle result...
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('No connected nodes')) {
        return 'Music service is currently unavailable. Please try again later.';
      } else if (error.message.includes('timeout')) {
        return 'Request timed out. Please try again.';
      } else {
        console.error('Play command error:', error);
        return 'An error occurred while playing the track.';
      }
    }
  }
}
```

## Custom Events

### Implementing Custom Event Logic

```typescript
import { Manager, Events, Track, Player } from 'lava.ts';

class EnhancedManager extends Manager {
  private trackHistory: Map<string, Track[]> = new Map();

  constructor(options: ManagerOptions) {
    super(options);

    // Track history
    this.on(Events.TrackEnd, (player, track, reason) => {
      if (reason === 'finished') {
        const history = this.trackHistory.get(player.guildId) || [];
        history.push(track);
        if (history.length > 50) history.shift(); // Keep last 50
        this.trackHistory.set(player.guildId, history);
      }
    });
  }

  public getHistory(guildId: string): Track[] {
    return this.trackHistory.get(guildId) || [];
  }

  // Custom event: track recommendation
  public async getRecommendations(guildId: string, count: number = 5): Promise<Track[]> {
    const history = this.getHistory(guildId);
    if (history.length === 0) return [];

    // Get recommendations based on last track
    const lastTrack = history[history.length - 1];
    const result = await this.search(`${lastTrack.info.author} ${lastTrack.info.title}`);
    
    if (result.loadType === 'search') {
      return result.data.slice(0, count);
    }

    return [];
  }
}
```

## Performance Optimization

### Connection Pooling

```typescript
// Configure nodes for optimal performance
const manager = new Manager({
  nodes: [
    {
      name: 'Node 1',
      host: 'node1.example.com',
      port: 2333,
      password: 'password',
      resumeTimeout: 60,     // Resume session within 60 seconds
      maxReconnectAttempts: 5, // Limit reconnection attempts
      reconnectDelay: 2000,    // Initial delay before reconnection
    },
    // Add multiple nodes for load distribution
  ],
});
```

### Efficient Queue Management

```typescript
// Lazy load queue information
class OptimizedPlayer extends Player {
  private queueCache: Map<string, any> = new Map();

  public getQueueInfo() {
    const cacheKey = 'queue-info';
    const cached = this.queueCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached.data;
    }

    const info = {
      length: this.queue.length,
      duration: this.getQueueDuration(),
      tracks: this.queue.slice(0, 10), // Only first 10 for display
    };

    this.queueCache.set(cacheKey, {
      data: info,
      timestamp: Date.now(),
    });

    return info;
  }
}
```

### Memory Management

```typescript
// Clear old data periodically
setInterval(() => {
  for (const player of manager.getPlayers()) {
    // Clear previous tracks older than 1 hour
    if (player.previousTracks.length > 0) {
      player.previousTracks = player.previousTracks.slice(-10);
    }
  }
}, 3600000); // Every hour
```

### Connection Monitoring

```typescript
// Monitor node health
setInterval(async () => {
  const health = await manager.healthCheck();
  const stats = manager.getStats();
  
  console.log('Health Check:', {
    connectedNodes: stats.connectedNodes,
    totalPlayers: stats.totalPlayers,
    averageCpu: stats.averageCpuLoad,
  });

  // Alert if unhealthy
  if (stats.connectedNodes === 0) {
    alertAdmin('All Lavalink nodes are down!');
  }
}, 60000); // Every minute
```

## Best Practices

1. **Always handle errors** - Use try-catch blocks and event listeners
2. **Implement reconnection logic** - The library handles it, but monitor it
3. **Use multiple nodes** - For redundancy and load distribution
4. **Cache search results** - Avoid repeated searches for the same query
5. **Limit queue size** - Prevent memory issues with very large queues
6. **Clean up players** - Destroy players when not needed
7. **Monitor resource usage** - Keep track of node statistics
8. **Use TypeScript** - Leverage type safety for better DX

## Troubleshooting

### Common Issues

**Players not connecting:**
- Ensure voice state updates are forwarded to the manager
- Check that the bot has proper permissions in the voice channel
- Verify Lavalink server is running and accessible

**High latency:**
- Check node CPU/memory usage
- Consider adding more nodes
- Verify network connection between bot and Lavalink

**Tracks not loading:**
- Check Lavalink server logs
- Verify source managers are configured in Lavalink
- Test with different search queries/URLs

For more help, check the [GitHub Issues](https://github.com/yourusername/lava.ts/issues).
