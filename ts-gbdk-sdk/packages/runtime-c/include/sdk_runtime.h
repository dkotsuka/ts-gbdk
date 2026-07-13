#ifndef SDK_RUNTIME_H
#define SDK_RUNTIME_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

void sdk_wait_vblank(void);
void sdk_noop_u8(uint8_t value);

#ifdef __cplusplus
}
#endif

#endif
