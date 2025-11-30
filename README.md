# Lava.ts

> A professional-grade, TypeScript-first Lavalink v4 client library for Node.js

[![npm version](https://img.shields.io/npm/v/lava.ts.svg)](https://www.npmjs.com/package/lava.ts)
[![License](https://img.shields.io/npm/l/lava.ts.svg)](LICENSE)

## Features

### Core Features
- 🎯 **Full Lavalink v4 Support** - Complete implementation of the latest REST API and WebSocket protocol
- 🏗️ **TypeScript-First** - Strongly typed APIs with full autocomplete support
- ⚡ **Smart Load Balancing** - Advanced penalty system for optimal node selection
- 🔄 **Automatic Reconnection** - Exponential backoff with jitter for fault tolerance
- 🎨 **Fluent Filter API** - Chainable filter configuration for elegant code
- 🎭 **Event-Driven** - Comprehensive event system for reactive programming
- 🛡️ **Production-Ready** - Battle-tested design patterns and error handling

### Player Features
- ▶️ **Full Playback Control** - Play, pause, resume, stop, seek
- ⏭️ **Queue Management** - Add, remove, clear, shuffle queue
- ⏮️ **Previous Track** - Play previous tracks (last 10 stored)
- 🔀 **Shuffle** - Randomize queue order
- 🔊 **Volume Control** - 0-100% volume adjustment
- 🔍 **Multi-Platform Search** - YouTube, YouTube Music, SoundCloud support
- 📊 **Position Tracking** - Real-time playback position updates
- 🤖 **Intelligent AutoPlay** - Automatically plays related tracks when queue ends (YouTube, SoundCloud, Spotify)

### Audio Filters
- 🎚️ **10 Filter Types** - Volume, Equalizer, Karaoke, Timescale, Tremolo, Vibrato, Rotation, Distortion, ChannelMix, LowPass
- 🎵 **8 Equalizer Presets** - Bass, Treble, Soft, Flat, Electronic, Rock, Classical, Pop
- ✨ **5 Effect Presets** - Nightcore, Vaporwave, 8D Audio, Bassboost (4 levels), Soft
- 🔗 **Chainable API** - Fluent filter configuration with `filters().effect1().effect2().apply()`

## Installation

```bash
npm install lava.ts
```

## Quick Start

```typescript
import { Manager } from 'lava.ts';
import { Client } from 'discord.js';

const client = new Client({ intents: ['Guilds', 'GuildVoiceStates'] });

const manager = new Manager({
  nodes: [
    {
      name: 'Node 1',
      host: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
      secure: false
    }
  ],
  send: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  },
  autoPlay: true, // Enable intelligent AutoPlay
  debug: false // Disable debug logging
});

// Initialize manager after client is ready
client.on('ready', () => {
  manager.init(client.user!.id);
});

// Forward voice state updates
client.on('raw', (packet) => {
  if (manager.isInitialized()) {
    manager.updateVoiceState(packet);
  }
});

// Listen to events
manager.on('trackStart', (player, track) => {
  console.log(`Now playing: ${track.info.title}`);
});

manager.on('trackEnd', (player, track, reason) => {
  console.log(`Track ended: ${reason}`);
});

// Create and use a player
const player = manager.create({
  guildId: 'guild-id',
  voiceChannelId: 'voice-channel-id',
  textChannelId: 'text-channel-id'
});

await player.connect();

const result = await player.search('Never Gonna Give You Up');
if (result.loadType === 'track') {
  await player.play(result.data);
}

// Use filters with fluent API
await player.filters()
  .timescale({ speed: 1.2, pitch: 1.0, rate: 1.0 })
  .tremolo({ frequency: 4.0, depth: 0.5 })
  .karaoke()
  .apply();
```

## Architecture

### Node Manager
Manages multiple Lavalink nodes with intelligent load balancing based on:
- Player count (active and playing players)
- CPU load (normalized by core count)
- Memory usage
- Custom penalty calculations

### Player
Feature-rich player with:
- Play, pause, stop, seek controls
- Volume management
- Filter support (v4 filters: Timescale, Tremolo, Karaoke, Distortion, Rotation, etc.)
- Queue management
- Voice state handling

### Filter Builder
Chainable API for audio filters:
```typescript
player.filters()
  .volume(0.8)
  .equalizer([{ band: 0, gain: 0.2 }])
  .timescale({ speed: 1.1 })
  .tremolo({ frequency: 2.0, depth: 0.5 })
  .vibrato({ frequency: 2.0, depth: 0.5 })
  .rotation({ rotationHz: 0.2 })
  .distortion({ sinOffset: 0, sinScale: 1, cosOffset: 0, cosScale: 1, tanOffset: 0, tanScale: 1, offset: 0, scale: 1 })
  .channelMix({ leftToLeft: 1, leftToRight: 0, rightToLeft: 0, rightToRight: 1 })
  .lowPass({ smoothing: 20 })
  .apply();
```

## Events

- `nodeConnect` - Node connected successfully
- `nodeDisconnect` - Node disconnected
- `nodeError` - Node encountered an error
- `nodeReconnect` - Node attempting reconnection
- `trackStart` - Track started playing
- `trackEnd` - Track finished playing
- `trackStuck` - Track got stuck
- `trackException` - Track encountered an error
- `playerCreate` - Player created
- `playerDestroy` - Player destroyed
- `queueEnd` - Queue finished playing

## API Documentation

### Manager Options

```typescript
interface ManagerOptions {
  nodes: NodeOptions[];
  send: (guildId: string, payload: any) => void;
  clientId?: string;
  shards?: number;
  autoPlay?: boolean;
  defaultSearchPlatform?: 'ytsearch' | 'ytmsearch' | 'scsearch';
}
```

### Node Options

```typescript
interface NodeOptions {
  name: string;
  host: string;
  port: number;
  password: string;
  secure?: boolean;
  resumeKey?: string;
  resumeTimeout?: number;
}
```

### Player Options

```typescript
interface PlayerOptions {
  guildId: string;
  voiceChannelId: string;
  textChannelId?: string;
  selfDeafen?: boolean;
  selfMute?: boolean;
  volume?: number;
}
```

## Design Patterns

- **Singleton**: NodeManager for centralized node management
- **Factory**: Player creation through Manager
- **Builder**: Fluent API for filter configuration
- **Event-Driven**: Comprehensive event system for reactive patterns

## Fault Tolerance

- Automatic reconnection with exponential backoff
- Jitter to prevent thundering herd
- Node health monitoring
- Graceful degradation

## License

MIT © [ryxu-xo](https://github.com/ryxu-xo)

## Contributing

Contributions are welcome! Please read our contributing guidelines and code of conduct.

## Support

- [Documentation](https://github.com/ryxu-xo/lava.ts/wiki)
- [Issues](https://github.com/ryxu-xo/lava.ts/issues)
- [Discord Server](https://discord.gg/your-invite)
