#!/bin/bash

npm install -g vsce ovsx
npm run install:all

vsce package --out cline.vsix
