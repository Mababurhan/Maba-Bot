<?php
namespace Destiny\Tasks;

use Destiny\Common\Annotation\Schedule;
use Destiny\Common\Application;
use Destiny\Common\Config;
use Destiny\Common\Cron\TaskInterface;
use Destiny\Common\Images\ImageDownloadUtil;
use Destiny\Twitch\TwitchApiService;
use Destiny\Twitch\TwitchWebHookService;

/**
 * @Schedule(frequency=1,period="minute")
 */
class StreamInfo implements TaskInterface {

    public function execute() {
        $cache = Application::getNsCache();
        $twitchApiService = TwitchApiService::instance();

        $twitchChannelId = Config::$a['twitch']['id'];

        $info = $twitchApiService->getStreamStatus(
            $twitchChannelId,
            $cache->fetch('lasttimeonline')
        );
        if (!empty($info)) {
            $cache->save('lasttimeonline', $info['ended_at']);

            if (!empty($info['preview'])) {
                $path = ImageDownloadUtil::download($info['preview'], true);
            }
            if (!empty($path)) {
                $info['preview'] = Config::cdni() . '/' . $path;
            }

            $islive = !empty($info['host']) ? false : (($info['live'] == true) ? true : false);
            $cache->save(TwitchWebHookService::CACHE_KEY_PREFIX . Config::$a['twitch']['id'], ['time' => time(), 'live' => $islive]);
            $cache->save(TwitchWebHookService::CACHE_KEY_STREAM_STATUS, $info);
        }

        $hostedChannel = $twitchApiService->getHostedChannelForUser($twitchChannelId);
        if (!empty($hostedChannel) && !empty($hostedChannel['preview'])) {
            $path = ImageDownloadUtil::download($hostedChannel['preview'], true);
            $hostedChannel['preview'] = !empty($path) ? Config::cdni() . '/' . $path : null;
        }

        $cache->save(TwitchWebHookService::CACHE_KEY_HOSTED_CHANNEL, $hostedChannel);
    }
}
