#!/bin/bash

npm config set registry https://registry.npmmirror.com
npm install -g vsce ovsx
npm run install:all

vsce package --out cline.vsix
