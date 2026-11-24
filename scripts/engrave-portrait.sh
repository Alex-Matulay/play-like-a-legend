#!/bin/sh
# usage: engrave.sh in.jpg crop_geometry out.jpg
in=$1; geo=$2; out=$3; t=eg_tmp
magick "$in" -crop "$geo" +repage -resize 512x512! -colorspace Gray -auto-level -sigmoidal-contrast 3,50% $t-base.png
magick $t-base.png \( +clone -blur 0x1.2 -edge 1 -negate -level 25%,100% \) -compose multiply -composite $t-lines.png
magick -size 512x512 pattern:hs_diagcross -negate -level 0%,40% -negate $t-hatch.png
magick $t-lines.png $t-hatch.png -compose overlay -composite $t-hatched.png
magick -size 512x512 radial-gradient:white-black -level 5%,45% $t-mask.png
magick -size 512x512 xc:white $t-hatched.png $t-mask.png -composite +level-colors "#3d2614","#f4e8cf" -quality 86 "$out"
rm -f $t-*.png
