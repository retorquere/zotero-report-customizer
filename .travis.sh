#!/bin/bash

set -e
set -u

DEBUGBUILD=false XPI=`rake xpi`

RELEASE="$TRAVIS_COMMIT release: $XPI"
CHECKIN=`git log -n 1 --pretty=oneline`
echo "checkin: $CHECKIN"
echo "release: $RELEASE"
if [ "$CHECKIN" = "$RELEASE" ] ; then
  rm -f *.xpi
  DEBUGBUILD=false rake

  bundle exec rake deploy
fi
