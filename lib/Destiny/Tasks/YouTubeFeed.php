<?php
namespace Destiny\Tasks;

use Destiny\Common\Annotation\Schedule;
use Destiny\Common\Application;
use Destiny\Common\Config;
use Destiny\Common\Cron\TaskInterface;
use Destiny\Common\Images\ImageDownloadUtil;
use Destiny\YouTube\YouTubeAdminApiService;

/**
 * @Schedule(frequency=30,period="minute")
 */
class YouTubeFeed implements TaskInterface {

    public function execute() {
        return null;

        $json = YouTubeAdminApiService::instance()->getRecentYouTubeUploads();
        if (!empty ($json)) {
            foreach ($json ['items'] as $i => $item) {
                $path = ImageDownloadUtil::download($json ['items'][$i]['snippet']['thumbnails']['high']['url']);
                if (!empty($path))
                    $json ['items'][$i]['snippet']['thumbnails']['high']['url'] = Config::cdni() . '/' . $path;
            }
            $cache = Application::getNsCache();
            $cache->save('youtubeplaylist', $json);
        }
    }

}
