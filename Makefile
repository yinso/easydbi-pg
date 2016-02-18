VPATH=src
BUILDDIR=lib

BEANDIR=.
JSONDIR=.

COFFEE_SOURCES= $(wildcard $(VPATH)/*.coffee)
COFFEE_OBJECTS=$(patsubst $(VPATH)/%.coffee, $(BUILDDIR)/%.js, $(COFFEE_SOURCES))

CLIENT_JS_FILES = $(wildcard client/*.coffee)

all: build

.PHONY: build
build: node_modules objects

.PHONY: objects
objects: $(COFFEE_OBJECTS) $(JSON_FILES)

.PHONY: clean
clean:
	rm -f $(COFFEE_OBJECTS)

.PHONE: pristine
pristine: clean
	rm -rf node_modules

node_modules:
	npm install -d

$(BUILDDIR)/%.js: $(VPATH)/%.coffee
	./node_modules/.bin/coffee -o $(BUILDDIR) -c $<

