#include <gb/gb.h>
#include "sdk_runtime.h"

void sdk_wait_vblank(void) {
    vsync();
}

void sdk_noop_u8(uint8_t value) {
    (void)value;
}
