# API Reference

Complete API documentation for Lava.ts.

## Table of Contents

- [Manager](#manager)
- [Node](#node)
- [Player](#player)
- [FilterBuilder](#filterbuilder)
- [Events](#events)
- [Types](#types)

---

## Manager

The main entry point for the library.

### Constructor

```typescript
new Manager(options: ManagerOptions)
```

**Parameters:**
- `options.nodes` - Array of node configurations
- `options.send` - Function to send Discord gateway payloads
- `options.clientId?` - Bot client ID (can be set in init)
- `options.shards?` - Number of shards (default: 1)
- `options.autoPlay?` - Auto-play next track (default: true)
- `options.defaultSearchPlatform?` - Default search platform (default: 'ytsearch')

### Methods

#### `init(clientId?: string): Promise<void>`
Initialize the manager and connect to all configured nodes.

#### `create(options: PlayerOptions): Player`
Create or get a player for a guild.

#### `get(guildId: string): Player | undefined`
Get an existing player by guild ID.

#### `destroyPlayer(guildId: string): Promise<boolean>`
Destroy a player and leave the voice channel.

#### `getPlayers(): Player[]`
Get all active players.

#### `has(guildId: string): boolean`
Check if a player exists for a guild.

#### `updateVoiceState(packet: DiscordVoiceEvent): void`
Update voice state from Discord raw events.

#### `search(query: string, platform?: SearchPlatformType): Promise<LoadResult>`
Search for tracks.

#### `load(identifier: string): Promise<LoadResult>`
Load tracks from a URL or identifier.

#### `getStats(): AggregateStats`
Get aggregate statistics from all nodes.

#### `healthCheck(): Promise<Map<string, boolean>>`
Perform health check on all nodes.

#### `destroyAll(): Promise<void>`
Destroy all players and disconnect from all nodes.

### Events

```typescript
manager.on('nodeConnect', (node: Node) => {});
manager.on('nodeDisconnect', (node: Node, code: number, reason: string) => {});
manager.on('nodeError', (node: Node, error: Error) => {});
manager.on('trackStart', (player: Player, track: Track) => {});
manager.on('trackEnd', (player: Player, track: Track, reason: TrackEndReason) => {});
manager.on('trackException', (player: Player, track: Track, exception: TrackException) => {});
manager.on('queueEnd', (player: Player) => {});
```

---

## Node

Represents a single Lavalink node connection.

### Properties

- `options: NodeOptions` - Node configuration
- `state: NodeState` - Current connection state
- `stats: NodeStats | null` - Node statistics
- `sessionId: string | null` - Session ID
- `info: NodeInfo | null` - Node information

### Methods

#### `connect(clientId: string): Promise<void>`
Connect to the Lavalink node.

#### `disconnect(): void`
Disconnect from the node.

#### `loadTracks(identifier: string): Promise<LoadResult>`
Load tracks from a search query or URL.

#### `updatePlayer(guildId: string, payload: UpdatePlayerPayload): Promise<PlayerResponse>`
Update a player (v4 consolidated endpoint).

#### `destroyPlayer(guildId: string): Promise<void>`
Destroy a player on this node.

#### `getInfo(): Promise<NodeInfo>`
Get node information.

#### `getStats(): Promise<NodeStats>`
Get node statistics.

#### `isConnected(): boolean`
Check if node is connected.

#### `getPenalty(): number`
Get node penalty for load balancing.

---

## Player

Manages audio playback for a guild.

### Properties

- `guildId: string` - Guild ID
- `voiceChannelId: string` - Voice channel ID
- `textChannelId?: string` - Text channel ID
- `node: Node` - Assigned node
- `track: Track | null` - Current track
- `volume: number` - Current volume (0-100)
- `paused: boolean` - Pause state
- `position: number` - Current position in ms
- `connected: boolean` - Connection state
- `queue: Track[]` - Queue of upcoming tracks
- `previousTracks: Track[]` - History of played tracks

### Methods

#### `connect(): Promise<void>`
Connect to the voice channel.

#### `disconnect(): Promise<void>`
Disconnect from the voice channel.

#### `destroy(): Promise<void>`
Destroy the player and clean up resources.

#### `play(track?: Track, options?: PlayOptions): Promise<void>`
Play a track or the next track in queue.

#### `pause(pause?: boolean): Promise<void>`
Pause or resume playback.

#### `resume(): Promise<void>`
Resume playback.

#### `stop(): Promise<void>`
Stop playback.

#### `seek(position: number): Promise<void>`
Seek to a position in milliseconds.

#### `setVolume(volume: number): Promise<void>`
Set volume (0-100).

#### `filters(): FilterBuilder`
Get the filter builder for chainable filter configuration.

#### `setFilters(filters: FilterOptions): Promise<void>`
Set filters directly.

#### `clearFilters(): Promise<void>`
Clear all filters.

#### `addTrack(track: Track): void`
Add a track to the queue.

#### `addTracks(tracks: Track[]): void`
Add multiple tracks to the queue.

#### `removeTrack(index: number): Track | undefined`
Remove a track from the queue by index.

#### `clearQueue(): void`
Clear the queue.

#### `shuffleQueue(): void`
Shuffle the queue.

#### `skip(): Promise<boolean>`
Skip to the next track in the queue.

#### `previous(): Promise<boolean>`
Play the previous track.

#### `search(query: string, platform?: SearchPlatformType): Promise<LoadResult>`
Search for tracks.

#### `load(identifier: string): Promise<LoadResult>`
Load tracks from a URL or identifier.

#### `isPlaying(): boolean`
Check if player is currently playing.

#### `getQueueDuration(): number`
Get total queue duration in milliseconds.

#### `moveTrack(from: number, to: number): boolean`
Move a track in the queue.

---

## FilterBuilder

Provides a fluent API for configuring audio filters.

### Methods

#### `volume(volume: number): this`
Set volume (0.0 - 5.0).

#### `equalizer(bands: EqualizerBand[]): this`
Set equalizer bands.

#### `equalizerPreset(preset: PresetName): this`
Apply an equalizer preset.

Available presets: `Bass`, `Treble`, `Soft`, `Flat`, `Electronic`, `Rock`, `Classical`, `Pop`

#### `karaoke(options?: KaraokeFilter): this`
Enable karaoke effect.

#### `timescale(options: TimescaleFilter): this`
Set timescale (speed, pitch, rate).

#### `tremolo(options: TremoloFilter): this`
Set tremolo effect.

#### `vibrato(options: VibratoFilter): this`
Set vibrato effect.

#### `rotation(options: RotationFilter): this`
Set rotation effect (8D audio).

#### `distortion(options: DistortionFilter): this`
Set distortion effect.

#### `channelMix(options: ChannelMixFilter): this`
Set channel mix (stereo manipulation).

#### `lowPass(options: LowPassFilter): this`
Set low pass filter.

#### `nightcore(speed?: number): this`
Apply nightcore effect (default speed: 1.3).

#### `vaporwave(speed?: number): this`
Apply vaporwave effect (default speed: 0.8).

#### `eightD(rotationHz?: number): this`
Apply 8D audio effect (default: 0.2).

#### `bassboost(level?: 'low' | 'medium' | 'high' | 'extreme'): this`
Apply bass boost (default: 'medium').

#### `soft(): this`
Apply soft audio effect.

#### `clear(): this`
Clear all filters.

#### `clearFilter(filter: keyof FilterOptions): this`
Clear a specific filter.

#### `getFilters(): FilterOptions`
Get current filter configuration.

#### `setFilters(filters: FilterOptions): this`
Set filters from a configuration object.

#### `mergeFilters(filters: Partial<FilterOptions>): this`
Merge with existing filters.

#### `apply(): Promise<void>`
Apply the configured filters to the player.

#### `clone(): FilterBuilder`
Create a copy of this filter builder.

---

## Events

Event names exported from the `Events` constant:

```typescript
import { Events } from 'lava.ts';

// Node events
Events.NodeConnect
Events.NodeDisconnect
Events.NodeError
Events.NodeReconnect
Events.NodeStats

// Player events
Events.PlayerCreate
Events.PlayerDestroy
Events.PlayerMove

// Track events
Events.TrackStart
Events.TrackEnd
Events.TrackStuck
Events.TrackException

// Queue events
Events.QueueEnd

// WebSocket events
Events.SocketClosed

// Debug events
Events.Debug
```

---

## Types

### Core Types

```typescript
interface NodeOptions {
  name: string;
  host: string;
  port: number;
  password: string;
  secure?: boolean;
  resumeKey?: string;
  resumeTimeout?: number;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

interface PlayerOptions {
  guildId: string;
  voiceChannelId: string;
  textChannelId?: string;
  selfDeafen?: boolean;
  selfMute?: boolean;
  volume?: number;
}

interface Track {
  encoded: string;
  info: TrackInfo;
  pluginInfo: Record<string, unknown>;
  userData?: Record<string, unknown>;
}

interface TrackInfo {
  identifier: string;
  isSeekable: boolean;
  author: string;
  length: number;
  isStream: boolean;
  position: number;
  title: string;
  uri: string | null;
  artworkUrl: string | null;
  isrc: string | null;
  sourceName: string;
}
```

### Load Results

```typescript
type LoadResult =
  | LoadResultTrack      // Single track
  | LoadResultPlaylist   // Playlist with multiple tracks
  | LoadResultSearch     // Search results
  | LoadResultEmpty      // No results
  | LoadResultError;     // Error occurred

interface LoadResultTrack {
  loadType: 'track';
  data: Track;
}

interface LoadResultPlaylist {
  loadType: 'playlist';
  data: Playlist;
}

interface LoadResultSearch {
  loadType: 'search';
  data: Track[];
}

interface LoadResultEmpty {
  loadType: 'empty';
  data: Record<string, never>;
}

interface LoadResultError {
  loadType: 'error';
  data: {
    message: string;
    severity: 'common' | 'suspicious' | 'fault';
    cause: string;
  };
}
```

### Filter Types

```typescript
interface FilterOptions {
  volume?: number;
  equalizer?: EqualizerBand[];
  karaoke?: KaraokeFilter;
  timescale?: TimescaleFilter;
  tremolo?: TremoloFilter;
  vibrato?: VibratoFilter;
  rotation?: RotationFilter;
  distortion?: DistortionFilter;
  channelMix?: ChannelMixFilter;
  lowPass?: LowPassFilter;
}

interface EqualizerBand {
  band: number;    // 0-14
  gain: number;    // -0.25 to 1.0
}

interface TimescaleFilter {
  speed?: number;  // >0
  pitch?: number;  // >0
  rate?: number;   // >0
}

interface TremoloFilter {
  frequency: number;  // >0
  depth: number;      // 0.0 - 1.0
}

// ... other filter types
```

### Search Platforms

```typescript
type SearchPlatformType = 
  | 'ytsearch'   // YouTube
  | 'ytmsearch'  // YouTube Music
  | 'scsearch'   // SoundCloud
  | 'spsearch'   // Spotify
  | 'amsearch';  // Apple Music
```

---

## Examples

### Basic Usage

```typescript
import { Manager } from 'lava.ts';

const manager = new Manager({
  nodes: [{
    name: 'Main',
    host: 'localhost',
    port: 2333,
    password: 'youshallnotpass',
  }],
  send: (guildId, payload) => {
    // Send to Discord
  },
});

await manager.init(clientId);

const player = manager.create({
  guildId: '123',
  voiceChannelId: '456',
});

await player.connect();
const result = await player.search('never gonna give you up');
if (result.loadType === 'track') {
  await player.play(result.data);
}
```

### With Filters

```typescript
await player.filters()
  .bassboost('high')
  .nightcore()
  .rotation({ rotationHz: 0.2 })
  .apply();
```

### Event Handling

```typescript
manager.on('trackStart', (player, track) => {
  console.log(`Playing: ${track.info.title}`);
});

manager.on('trackEnd', async (player, track, reason) => {
  if (reason === 'finished' && player.queue.length === 0) {
    console.log('Queue finished');
  }
});
```

For more examples, see the [examples directory](../examples/).
