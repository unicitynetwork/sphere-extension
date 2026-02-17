.PHONY: install dev build package publish version bump-patch bump-minor bump-major lint clean help

VERSION := $(shell node -p "require('./package.json').version")

help:
	@echo "Sphere Extension - Available commands:"
	@echo ""
	@echo "  make install       Install dependencies"
	@echo "  make dev           Start dev/watch mode"
	@echo "  make build         Build extension for production"
	@echo "  make package       Build and zip for distribution"
	@echo "  make publish       Package and publish as GitHub Release"
	@echo "  make version       Show current version"
	@echo "  make bump-patch    Bump patch version (0.1.0 -> 0.1.1)"
	@echo "  make bump-minor    Bump minor version (0.1.0 -> 0.2.0)"
	@echo "  make bump-major    Bump major version (0.1.0 -> 1.0.0)"
	@echo "  make lint          Run ESLint"
	@echo "  make clean         Remove build output and node_modules"
	@echo ""
	@echo "After building:"
	@echo "  Load unpacked from dist/ in chrome://extensions"

install:
	npm install

dev:
	npm run dev

build:
	npm run build
	@echo "Built. Load unpacked from dist/ in chrome://extensions"

package:
	npm run package
	@echo "Zip ready: sphere-wallet-v$(VERSION).zip"

publish: package
	@echo "Publishing Sphere Wallet v$(VERSION)..."
	git tag -f "v$(VERSION)"
	git push origin "v$(VERSION)" --force
	gh release create "v$(VERSION)" \
		sphere-wallet-v$(VERSION).zip \
		--title "Sphere Wallet v$(VERSION)" \
		--notes "Download **sphere-wallet-v$(VERSION).zip**, unzip, then load as unpacked extension in \`chrome://extensions\` (Developer mode)."
	@echo "Published: https://github.com/unicitynetwork/sphere-extension/releases/tag/v$(VERSION)"

version:
	@echo "Sphere Wallet v$(VERSION)"

define do-bump
	npm version $(1) --no-git-tag-version
	@NEW_VER=$$(node -p "require('./package.json').version"); \
	sed -i '' "s/\"version\": \".*\"/\"version\": \"$$NEW_VER\"/" public/manifest.json; \
	echo "Bumped to v$$NEW_VER"
endef

bump-patch:
	$(call do-bump,patch)

bump-minor:
	$(call do-bump,minor)

bump-major:
	$(call do-bump,major)

lint:
	npm run lint

clean:
	rm -rf node_modules dist *.zip
