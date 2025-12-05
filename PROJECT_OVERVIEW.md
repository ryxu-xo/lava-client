/*
* lavaflow Project Overview
*/


# lavaflow - Project Overview

## 🎯 Project Summary

**lavaflow** is a professional-grade, TypeScript-first Lavalink v4 client library for Node.js. It provides a feature-rich, stable, and developer-friendly interface for integrating Lavalink audio streaming into Discord bots and other applications.

## 📁 Complete Project Structure

```
lavaflow/
├── src/
│   ├── index.ts                      # Main entry point with all exports
│   ├── manager/
│   │   ├── Manager.ts                # High-level manager with convenience APIs
│   │   ├── VoiceForwarder.ts         # Voice state handling & forwarding
│   │   └── events.ts                 # Typed EventEmitter system
│   ├── nodes/
│   │   ├── Node.ts                   # Single node: WebSocket + REST + stats
│   │   └── NodeManager.ts            # Singleton with penalty system & load balancing
│   ├── player/
│   │   ├── Player.ts                 # Player class with v4 REST API
│   │   └── FilterBuilder.ts          # Chainable filter configuration
│   ├── types/
│   │   └── lavalink.ts               # Complete v4 type definitions
│   └── utils/
│       ├── http.ts                   # REST API client (fetch wrapper)
│       └── backoff.ts                # Exponential backoff utility
├── examples/
│   └── discord.js-example.ts         # Complete Discord.js integration example
├── docs/
│   ├── API.md                        # Complete API documentation
│   └── ADVANCED.md                   # Advanced usage patterns
├── tests/                            # Test directory (structure provided)
├── package.json                      # NPM package configuration
├── tsconfig.json                     # TypeScript configuration
├── .eslintrc.json                    # ESLint configuration
├── .gitignore                        # Git ignore patterns
├── README.md                         # Main documentation
├── CONTRIBUTING.md                   # Contribution guidelines
└── LICENSE                           # MIT License
```

## 🏗️ Architecture Highlights

### Design Patterns

1. **Singleton Pattern** - `NodeManager`
   - Single source of truth for node management
   - Centralized load balancing decisions
   - Consistent state across the application

2. **Factory Pattern** - Player creation via `Manager`
   - Consistent player instantiation
   - Automatic node assignment
   - Centralized lifecycle management

3. **Builder Pattern** - `FilterBuilder`
   - Fluent/chainable API
   - Type-safe filter configuration
   - Excellent developer experience

4. **Event-Driven Architecture**
   - Typed event emitters
   - Reactive programming patterns
   - Comprehensive event coverage

### Key Components

#### 1. Manager (`src/manager/Manager.ts`)
- High-level API entry point
- Player lifecycle management
- Node coordination
- Convenience methods for searching and loading tracks
- Event aggregation from nodes and players

**Key Features:**
- Auto-initialization of nodes
- Voice state forwarding integration
- Health monitoring
- Aggregate statistics

#### 2. Node (`src/nodes/Node.ts`)
- WebSocket connection management
- REST API operations
- Health monitoring with heartbeat
- Automatic reconnection with exponential backoff
- Session resumption support

**Key Features:**
- v4 WebSocket protocol compliance
- Player state tracking
- Stats collection and reporting
- Penalty calculation for load balancing

#### 3. NodeManager (`src/nodes/NodeManager.ts`)
- Singleton pattern implementation
- Penalty-based load balancing
- Node health tracking
- Pluggable penalty calculator

**Key Features:**
- Best node selection algorithm
- Aggregate statistics
- Custom penalty functions
- Health check operations

#### 4. Player (`src/player/Player.ts`)
- Per-guild audio playback control
- Queue management
- Track history
- Filter application
- Voice state management

**Key Features:**
- v4 Update Player REST endpoint
- Queue operations (add, remove, shuffle, move)
- Position tracking
- Previous track navigation

#### 5. FilterBuilder (`src/player/FilterBuilder.ts`)
- Chainable filter API
- Preset configurations
- Validation
- Effect combinations

**Key Features:**
- All v4 filters supported
- Preset effects (nightcore, vaporwave, 8D, bassboost)
- Equalizer presets (Bass, Treble, Rock, Pop, etc.)
- Filter state management

#### 6. VoiceForwarder (`src/manager/VoiceForwarder.ts`)
- Discord voice event interception
- State aggregation
- Lavalink forwarding
- Connection tracking

**Key Features:**
- VOICE_SERVER_UPDATE handling
- VOICE_STATE_UPDATE handling
- Complete state validation
- Player movement detection

### Type Safety

The library provides **comprehensive TypeScript definitions** for:
- All Lavalink v4 REST endpoints
- WebSocket event payloads
- Filter configurations
- Load result variants
- Node statistics
- Player state

**Type safety benefits:**
- Full IDE autocomplete
- Compile-time error detection
- Self-documenting code
- Refactoring confidence

## 🎨 Developer Experience (DX)

### 1. Type-First Design
```typescript
// Full autocomplete and type safety
const result: LoadResult = await player.search('query');

if (result.loadType === 'track') {
  // TypeScript knows result.data is Track
  await player.play(result.data);
}
```

### 2. Fluent API
```typescript
// Chainable filter configuration
await player.filters()
  .bassboost('high')
  .timescale({ speed: 1.2 })
  .rotation({ rotationHz: 0.2 })
  .apply();
```

### 3. Event-Driven
```typescript
// Typed event handlers
manager.on('trackStart', (player: Player, track: Track) => {
  console.log(`Playing: ${track.info.title}`);
});
```

### 4. Simple Initialization
```typescript
const manager = new Manager({
  nodes: [{ name: 'Main', host: 'localhost', port: 2333, password: 'pass' }],
  send: (guildId, payload) => guild.shard.send(payload),
});

await manager.init(clientId);
```

## 🔧 Technical Features

### Lavalink v4 Compliance

✅ **REST API**
- Update Player endpoint (`/v4/sessions/{sessionId}/players/{guildId}`)
- Load tracks endpoint
- Track decoding
- Session management
- Node info and stats

✅ **WebSocket Protocol**
- v4 WebSocket path (`/v4/websocket`)
- Required headers (Authorization, User-Id, Client-Name)
- Session resumption with Resume-Key
- Event handling (ready, playerUpdate, stats, track events)

✅ **Filters**
- Volume, Equalizer, Karaoke
- Timescale, Tremolo, Vibrato
- Rotation, Distortion, ChannelMix, LowPass

### Fault Tolerance

1. **Automatic Reconnection**
   - Exponential backoff with jitter
   - Configurable max attempts
   - Session resumption

2. **Health Monitoring**
   - Heartbeat tracking
   - Connection state management
   - Stats-based health checks

3. **Load Balancing**
   - Penalty-based node selection
   - CPU, memory, and player count factors
   - Frame stats consideration
   - Pluggable calculator

### Performance Optimizations

- Connection pooling across multiple nodes
- Efficient queue management
- Minimal memory footprint
- Position tracking with intervals
- Lazy evaluation where appropriate

## 📊 Statistics & Monitoring

The library provides comprehensive statistics:

```typescript
const stats = manager.getStats();
// {
//   totalNodes: 2,
//   connectedNodes: 2,
//   totalPlayers: 15,
//   totalPlayingPlayers: 12,
//   averageCpuLoad: 45.2,
//   totalMemoryUsed: 512000000,
//   totalMemoryAllocated: 1024000000
// }

const penalties = manager.getNodePenalties();
// Map { 'Node1' => 125, 'Node2' => 98 }

const health = await manager.healthCheck();
// Map { 'Node1' => true, 'Node2' => true }
```

## 🎯 Use Cases

1. **Discord Music Bots** - Primary use case
2. **Multi-platform Audio Bots** - Discord, Telegram, etc.
3. **Audio Streaming Services** - Backend audio processing
4. **Music Recommendation Systems** - Track loading and analysis
5. **Audio Effect Processors** - Filter application

## 🚀 Getting Started

### Installation
```bash
npm install lavaflow
```

### Quick Start
```typescript
import { Manager } from 'lavaflow';
import { Client } from 'discord.js';

const client = new Client({ /* ... */ });
const manager = new Manager({
  nodes: [{ name: 'Main', host: 'localhost', port: 2333, password: 'pass' }],
  send: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  },
});

client.once('ready', () => manager.init(client.user!.id));
client.on('raw', (packet) => manager.updateVoiceState(packet));

// Use the manager...
```

## 📚 Documentation

- **README.md** - Main documentation with quick start
- **docs/API.md** - Complete API reference
- **docs/ADVANCED.md** - Advanced patterns and optimization
- **examples/** - Working code examples
- **CONTRIBUTING.md** - Contribution guidelines

## 🎓 Educational Value

This library demonstrates:
- Professional TypeScript architecture
- Design pattern implementation
- WebSocket protocol handling
- REST API integration
- Event-driven programming
- Error handling and fault tolerance
- Load balancing algorithms
- Builder pattern for fluent APIs
- Singleton pattern for state management
- Factory pattern for object creation

## 🔮 Future Enhancements

Potential additions (beyond current scope):
- Plugin system for extensibility
- Database persistence for queues
- Analytics and metrics collection
- Rate limiting and request throttling
- Caching layer for search results
- Cluster support for multi-process
- gRPC support for node communication
- Admin dashboard for monitoring

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ for the Discord developer community**
