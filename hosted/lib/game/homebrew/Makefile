HOST_CC ?= cc
HOST_FLAGS = -std=c99 -Wall -Wextra -Werror -pedantic
BUILD = build

.PHONY: host-test host-worker dreamcast
host-test:
	mkdir -p $(BUILD)
	$(HOST_CC) $(HOST_FLAGS) slice.c test_slice.c -o $(BUILD)/test-slice
	./$(BUILD)/test-slice

host-worker:
	mkdir -p $(BUILD)
	$(HOST_CC) $(HOST_FLAGS) slice.c worker.c -o $(BUILD)/hail-worker

dreamcast:
	@test -n "$(KOS_BASE)" || { echo "KOS_BASE is required; activate the reviewed KallistiOS environment."; exit 2; }
	@command -v kos-cc >/dev/null || { echo "kos-cc is missing; build the SH4 toolchain first."; exit 2; }
	$(MAKE) -f Makefile.kos
