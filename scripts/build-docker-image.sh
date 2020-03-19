#!/usr/bin/env bash

# Set current folder to where the Dockerfile is
cd "$(dirname "$0")"/..
docker build -t puppeteer-confluence-setup .