import { createAudioClient, type AudioProxyOptions } from 'desktop-audio-proxy';
import {
  configureMediaElementForCompatibility,
  createMediaElementController,
  detectMediaEngine,
  type MediaElementController,
  type MediaSourceCandidate,
  selectPlayableMediaSource,
} from 'desktop-audio-proxy/browser';
import { startProxyServer, type ProxyConfig } from 'desktop-audio-proxy/server';

declare const media: HTMLAudioElement;

const clientOptions: AudioProxyOptions = {
  proxyUrl: 'http://localhost:3002',
};
const serverOptions: ProxyConfig = {
  allowedHosts: ['stream.example.com', '*.trusted-cdn.example'],
};
const controller: MediaElementController = createMediaElementController(
  media,
  clientOptions
);
const candidates: readonly MediaSourceCandidate[] = [
  { url: 'https://stream.example.com/live.aac', type: 'audio/aac' },
  { url: 'https://stream.example.com/live.mp3', type: 'audio/mpeg' },
];
const selected = selectPlayableMediaSource(media, candidates);
const profile = configureMediaElementForCompatibility(media);

void createAudioClient;
void detectMediaEngine;
void startProxyServer;
void serverOptions;
void controller;
void controller.loadBest(candidates);
void selected;
void profile;
