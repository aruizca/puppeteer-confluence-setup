#!/usr/bin/env bash

# Set current folder to where the Dockerfile is
cd "$(dirname "$0")"/..
docker build --platform linux/amd64 -t aruizca/puppeteer-confluence-setup .