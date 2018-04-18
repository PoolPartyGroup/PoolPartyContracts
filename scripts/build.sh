#!/usr/bin/env bash
echo Working directory - $PWD
rm build/contracts/*
echo "Cleaned build folder."
cp test-abis/* build/contracts
echo "Copied test ABI's to build folder."
echo "Compiling sources..."
truffle compile --all