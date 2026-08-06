[app]
title = Vanvidd
package.name = vanvidd
package.domain = org.gizmo6663

source.dir = .
source.include_exts = py,png,jpg,ttf,json
version = 0.1.0

# pygame-ce bygges av p4a-oppskriften "pygame" (SDL2-bootstrap)
requirements = python3,pygame

orientation = landscape
fullscreen = 1

android.archs = arm64-v8a
android.api = 34
android.minapi = 24
android.ndk = 25b
android.accept_sdk_license = True
android.enable_androidx = True
android.allow_backup = True

p4a.bootstrap = sdl2

[buildozer]
log_level = 2
warn_on_root = 0
