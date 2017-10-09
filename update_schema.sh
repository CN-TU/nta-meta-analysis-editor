#!/bin/sh

cp "$1/schema_v2.json" ./
git --git-dir="$1/.git" log -n 1 --format='%H' master -- schema_v2.json > commit.txt
