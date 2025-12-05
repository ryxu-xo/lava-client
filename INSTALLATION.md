/*
* lavaflow Installation
*/


# Installation & Setup Guide

Complete guide for installing and setting up lavaflow in your project.

## Prerequisites

- **Node.js**: v16.0.0 or higher
- **TypeScript**: v5.0.0 or higher (for development)
- **Lavalink Server**: v4.0.0 or higher running and accessible
- **Discord Bot**: Discord.js v14.x or compatible library

## Installing Lavalink Server

Before using lavaflow, you need a Lavalink v4 server running.

### Option 1: Docker (Recommended)

```bash
docker run -d \
  --name lavalink \
  -p 2333:2333 \
  -v $(pwd)/application.yml:/opt/Lavalink/application.yml \
  ghcr.io/lavalink-devs/lavalink:4
```

### Option 2: Manual Installation

1. Download Lavalink v4 from [GitHub Releases](https://github.com/lavalink-devs/Lavalink/releases)
2. Create `application.yml`:

```yaml
server:
  port: 2333
  address: 0.0.0.0

lavalink:
  server:
    password: "youshallnotpass"
    sources:
      youtube: true
      bandcamp: true
      soundcloud: true
      twitch: true
      vimeo: true
      http: true
      local: false
    filters:
      volume: true
      equalizer: true
      karaoke: true
      timescale: true
      tremolo: true
      vibrato: true
      distortion: true
      rotation: true
      channelMix: true
      lowPass: true
    bufferDurationMs: 400
    frameBufferDurationMs: 5000
    youtubePlaylistLoadLimit: 6
    playerUpdateInterval: 5
    youtubeSearchEnabled: true
    soundcloudSearchEnabled: true
    gc-warnings: true

metrics:
  prometheus:
    enabled: false
    endpoint: /metrics

sentry:
  dsn: ""
  environment: ""

logging:
  file:
    path: ./logs/
  level:
    root: INFO
    lavalink: INFO
```

3. Run Lavalink:

```bash
java -jar Lavalink.jar
```

## Installing lavaflow

### For Production

```bash
npm install lavaflow
```

### For Development

1. **Clone the repository:**

```bash
git clone https://github.com/ryxu-xo/lavaflow.git
cd lavaflow
```

2. **Install dependencies:**

```bash
npm install
```

3. **Build the library:**

```bash
npm run build
```

4. **Link for local development:**

```bash
npm link
```

Then in your project:

```bash
npm link lavaflow
```

## Project Setup

### TypeScript Configuration

Ensure your `tsconfig.json` has proper settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

### Discord.js v14 Setup

1. **Install Discord.js:**

```bash
npm install discord.js
```

2. **Create your bot file (bot.ts):**

```typescript
import { Client, GatewayIntentBits } from 'discord.js';
import { Manager } from 'lavaflow';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const manager = new Manager({
  nodes: [
    {
      name: 'Main Node',
      host: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
      secure: false,
    },
  ],
  send: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  },
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user!.tag}`);
  await manager.init(client.user!.id);
  console.log('Lavalink manager initialized');
});

client.on('raw', (packet) => {
  manager.updateVoiceState(packet);
});

client.login('YOUR_BOT_TOKEN');
```

3. **Run your bot:**

```bash
npx ts-node bot.ts
# or
npm run build && node dist/bot.js
```

## Environment Variables

Create a `.env` file:

```env
# Discord
DISCORD_TOKEN=your_bot_token_here

# Lavalink
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false

# Optional
NODE_ENV=development
```

Load environment variables:

```bash
npm install dotenv
```

```typescript
import 'dotenv/config';

const manager = new Manager({
  nodes: [{
    name: 'Main',
    host: process.env.LAVALINK_HOST!,
    port: parseInt(process.env.LAVALINK_PORT!),
    password: process.env.LAVALINK_PASSWORD!,
    secure: process.env.LAVALINK_SECURE === 'true',
  }],
  send: (guildId, payload) => { /* ... */ },
});
```

## Verification

### Test Lavalink Connection

```typescript
manager.on('nodeConnect', (node) => {
  console.log(`✅ Connected to ${node.options.name}`);
});

manager.on('nodeError', (node, error) => {
  console.error(`❌ Error on ${node.options.name}:`, error);
});

await manager.init(clientId);

// Check health
const health = await manager.healthCheck();
console.log('Node Health:', health);

// Check stats
const stats = manager.getStats();
console.log('Stats:', stats);
```

### Test Player Creation

```typescript
const player = manager.create({
  guildId: 'YOUR_GUILD_ID',
  voiceChannelId: 'YOUR_VOICE_CHANNEL_ID',
  textChannelId: 'YOUR_TEXT_CHANNEL_ID',
});

await player.connect();
console.log('Player created and connected');

// Test search
const result = await player.search('test search query');
console.log('Search result:', result.loadType);

if (result.loadType === 'search' && result.data.length > 0) {
  await player.play(result.data[0]);
  console.log('✅ Everything is working!');
}
```

## Common Issues

### "No connected nodes available"

**Solution:** Ensure Lavalink server is running and accessible:

```bash
curl http://localhost:2333/version
```

### "Cannot connect to Lavalink"

**Solutions:**
1. Check if Lavalink is running
2. Verify host/port in configuration
3. Check password matches
4. Ensure firewall allows connections

### "Voice connection not establishing"

**Solutions:**
1. Ensure bot has proper permissions (Connect, Speak)
2. Verify voice state updates are being forwarded:
   ```typescript
   client.on('raw', (packet) => {
     console.log('Raw packet:', packet.t);
     manager.updateVoiceState(packet);
   });
   ```
3. Check Discord.js intents include `GuildVoiceStates`

### TypeScript Errors

**Solutions:**
1. Ensure TypeScript version is 5.0+
2. Install type definitions: `npm install @types/node @types/ws`
3. Set `"skipLibCheck": true` in tsconfig.json

## Production Deployment

### Recommended Setup

1. **Multiple Lavalink Nodes:**
```typescript
const manager = new Manager({
  nodes: [
    { name: 'Node1-US', host: 'node1.us.example.com', port: 2333, password: 'pass' },
    { name: 'Node2-US', host: 'node2.us.example.com', port: 2333, password: 'pass' },
    { name: 'Node1-EU', host: 'node1.eu.example.com', port: 2333, password: 'pass' },
  ],
  // ...
});
```

2. **Error Monitoring:**
```typescript
manager.on('nodeError', (node, error) => {
  // Send to error tracking service (Sentry, etc.)
  errorTracker.capture(error, { node: node.options.name });
});
```

3. **Health Checks:**
```typescript
setInterval(async () => {
  const health = await manager.healthCheck();
  // Send metrics to monitoring service
}, 60000);
```

4. **Graceful Shutdown:**
```typescript
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await manager.destroyAll();
  process.exit(0);
});
```

## Next Steps

- Read the [API Documentation](./docs/API.md)
- Check [Advanced Usage Guide](./docs/ADVANCED.md)
- Explore [Examples](./examples/)
- Join our [Discord Server](#) for support

## Support

- **GitHub Issues:** Report bugs and request features
- **Discord:** Join our community for help
- **Documentation:** Check the docs folder

Happy coding! 🎵
