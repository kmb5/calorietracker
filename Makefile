login:
	flixos aws login --profile DeveloperClaudeCodeDATAAIDev

build:
	docker build \
		--build-arg AGENT_UID=$(shell id -u) \
		--build-arg AGENT_GID=1000 \
		-t sandcastle:calorietracker_v3 \
		.sandcastle/

run:
	pnpm tsx .sandcastle/main.mts

.PHONY: build run
