# Adds SceneDelegate.swift to the target of an Xcode project, next to AppDelegate.swift.
# Usage: bundle exec ruby scripts/e2e/add-scene-delegate.rb <project.xcodeproj> <target>
require 'xcodeproj'

project_path, target_name = ARGV
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |candidate| candidate.name == target_name }
abort "no target named #{target_name} in #{project_path}" if target.nil?

app_delegate = project.files.find { |file| file.path.end_with?('AppDelegate.swift') }
abort "no AppDelegate.swift in #{project_path}" if app_delegate.nil?

exit 0 if project.files.any? { |file| file.path.end_with?('SceneDelegate.swift') }

scene_delegate = app_delegate.parent.new_reference(app_delegate.path.sub('AppDelegate.swift', 'SceneDelegate.swift'))
target.source_build_phase.add_file_reference(scene_delegate)
project.save
