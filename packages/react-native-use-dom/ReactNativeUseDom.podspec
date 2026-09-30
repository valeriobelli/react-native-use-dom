require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# The oldest React Native this library is built and tested against. Older versions fail here, with
# the requirement named, rather than later with a compiler error.
min_react_native_minor = 81
min_ios_version = "15.1"

react_native_package = `cd "#{Pod::Config.instance.installation_root}" && node --print "require.resolve('react-native/package.json')"`.strip
if File.exist?(react_native_package)
  react_native_version = JSON.parse(File.read(react_native_package))["version"]
  if react_native_version.split(".")[1].to_i < min_react_native_minor
    raise "[react-native-use-dom] React Native 0.#{min_react_native_minor} or newer is required; this app uses #{react_native_version}."
  end
end
if ENV["RCT_NEW_ARCH_ENABLED"] == "0"
  raise "[react-native-use-dom] The New Architecture is required. Remove RCT_NEW_ARCH_ENABLED=0 and run `pod install` again."
end

Pod::Spec.new do |s|
  s.name         = "ReactNativeUseDom"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version }
  s.source       = { :git => "https://github.com/valeriobelli/react-native-use-dom.git", :tag => "#{s.version}" }

  s.source_files = [
    "ios/**/*.{swift}",
    "ios/**/*.{m,mm}",
  ]

  load "nitrogen/generated/ios/ReactNativeUseDom+autolinking.rb"
  add_nitrogen_files(s)

  s.dependency "React-jsi"
  s.dependency "React-callinvoker"
  install_modules_dependencies(s)
end
