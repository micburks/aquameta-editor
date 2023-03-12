#!/bin/bash

rm -rf dist/*LICENSE.txt
rm -rf data/
rm -rf versioned/

mkdir versioned
mv dist/*@* ./versioned
rm -rf dist/
mv versioned dist
