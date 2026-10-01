@echo off
cd /d "%~dp0"
echo ECHO//FALL
echo Open http://127.0.0.1:4173 in your browser.
echo Keep this window open while playing.
node server.js
pause
