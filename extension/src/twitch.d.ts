// Minimal typings for the Twitch Extension Helper (`window.Twitch.ext`), loaded
// via the twitch-ext.min.js script tag in index.html / config.html.
// See https://dev.twitch.tv/docs/extensions/reference/#helper-extensions

export {};

declare global {
  interface Window {
    Twitch?: {
      ext: TwitchExt;
    };
  }
}

interface TwitchAuth {
  channelId: string;
  clientId: string;
  token: string;
  userId: string;
  helixToken: string;
}

interface TwitchContext {
  arePlayerControlsVisible: boolean;
  bitrate: number;
  bufferSize: number;
  displayResolution: string;
  game: string;
  hlsLatencyBroadcaster: number;
  isFullScreen: boolean;
  isMuted: boolean;
  isPaused: boolean;
  isTheatreMode: boolean;
  language: string;
  mode: string;
  playbackMode: string;
  theme: "light" | "dark";
  videoResolution: string;
  volume: number;
}

interface TwitchConfigurationSegment {
  version: string;
  content: string;
}

interface TwitchConfiguration {
  broadcaster?: TwitchConfigurationSegment;
  developer?: TwitchConfigurationSegment;
  global?: TwitchConfigurationSegment;
  set(segment: "broadcaster" | "developer" | "global", version: string, content: string): void;
  onChanged(callback: () => void): void;
}

interface TwitchExt {
  configuration: TwitchConfiguration;
  onAuthorized(callback: (auth: TwitchAuth) => void): void;
  onContext(callback: (context: Partial<TwitchContext>, changed: string[]) => void): void;
  onError(callback: (error: unknown) => void): void;
  send(target: string, contentType: string, message: unknown): void;
  listen(target: string, callback: (target: string, contentType: string, message: string) => void): void;
  unlisten(target: string, callback: (target: string, contentType: string, message: string) => void): void;
}
