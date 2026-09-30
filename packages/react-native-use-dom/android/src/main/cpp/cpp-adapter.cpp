#include <jni.h>
#include <fbjni/fbjni.h>
#include "ReactNativeUseDomOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::usedom::registerAllNatives();
  });
}
