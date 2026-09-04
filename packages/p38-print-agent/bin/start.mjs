#!/usr/bin/env node
import { startPrintAgentServer, startRemotePoller } from '../src/server.mjs';

const { cfg } = startPrintAgentServer();
startRemotePoller(cfg);
