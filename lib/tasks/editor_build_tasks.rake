namespace :mnoe do
  namespace :frontend do
    task :build do
      frontend_dist_folder = "public/dashboard"
      frontend_tmp_folder = "tmp/build/frontend"

      # Copy webworker file
      rm_rf("#{frontend_dist_folder}/webworker")
      mkdir("#{frontend_dist_folder}/webworker")
      cp_r("render-summary/renderSummary.webWoker.js", "#{frontend_dist_folder}/webworker/renderSummary.webWoker.js")

      # Copy DomWorker file
      rm_rf("#{frontend_dist_folder}/editor")
      mkdir("#{frontend_dist_folder}/editor")
      cp_r("Async-Editor/async-editor.js", "#{frontend_dist_folder}/editor/async-editor.js")
      cp_r("Async-Editor/async-editor.css", "#{frontend_dist_folder}/editor/async-editor.css")
      cp_r("render-summary/renderSummary.css", "#{frontend_dist_folder}/editor/renderSummary.css")

      # Copy bluesky-editor dependencies
      cp_r("Async-Editor/mathjs", "#{frontend_dist_folder}/editor/mathjs" )
      cp_r("node_modules/moment-jdateformatparser", "#{frontend_dist_folder}/editor/moment-jdateformatparser" )
      cp("#{frontend_tmp_folder}/bower_components/jquery-ui/themes/cupertino/jquery-ui.min.css", "#{frontend_dist_folder}/editor/jquery-ui.min.css")
      cp_r("#{frontend_tmp_folder}/bower_components/jquery-ui/themes/cupertino/images", "#{frontend_dist_folder}/editor")

      # For development, copy editor and webworker folders to tmp directory
      cp_r("#{frontend_dist_folder}/editor", "#{frontend_tmp_folder}/src/editor")
      cp_r("#{frontend_dist_folder}/webworker", "#{frontend_tmp_folder}/src/webworker")
    end
  end
end
