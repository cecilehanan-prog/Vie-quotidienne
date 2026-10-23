#!/bin/sh
# Construit index.html (version installable) à partir de app-body.html.
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<meta name="theme-color" content="#2f6b4f"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg">\n'
  printf '<link rel="apple-touch-icon" href="icon.svg"><script src="jsbarcode.min.js" defer></script>\n'
  printf '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}img{max-width:100%%}</style>\n'
  printf '</head><body>\n'
  cat app-body.html
  printf '\n</body></html>\n'
} > index.html
