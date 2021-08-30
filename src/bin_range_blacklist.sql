CREATE TABLE `tbl_binrange_blacklist` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `bin_range` varchar(200) DEFAULT "",
    `description` varchar(200) DEFAULT "",
    `provider_id` int(11) NOT NULL,
    `enabled` boolean DEFAULT FALSE,
    `created` datetime DEFAULT CURRENT_TIMESTAMP,
    `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
)

INSERT INTO
    tbl_binrange_blacklist(bin_range,description,provider_id)
VALUES("34,37", "American Express", 713);


INSERT INTO
    tbl_binrange_blacklist(bin_range,description,provider_id)
VALUES("528497", "Capitec Debit Cards", 713);

INSERT INTO
    tbl_binrange_blacklist(bin_range,description,provider_id)
VALUES("425668", "Bidvest Cards", 713);

INSERT INTO
    tbl_binrange_blacklist(bin_range,description,provider_id)
VALUES("430864,430864", "Discovery SMS", 713);

INSERT INTO
    tbl_binrange_blacklist(bin_range,description,provider_id)
VALUES("484795", "Commonwealth SMS", 713);

INSERT INTO
    tbl_binrange_blacklist(bin_range,description,provider_id)
VALUES("418251,418252,489163", "Sasfin SMS", 713);

INSERT INTO
    tbl_binrange_blacklist(bin_range,description,provider_id)
VALUES("402151,433001,433002,470352", "Postbank SMS", 713);

INSERT INTO
    tbl_binrange_blacklist(bin_range,description,provider_id)
VALUES("36,38,6011", "Diners Club", 713);

INSERT INTO
    tbl_binrange_blacklist(bin_range,description,provider_id)
VALUES("353,354,355,356,357,358,3528,3529", "Diners Club", 713);

INSERT INTO
    tbl_binrange_blacklist(bin_range,description,provider_id)
VALUES("300,301,302,303,305", "Diners Club", 713);

INSERT INTO
    tbl_binrange_blacklist(bin_range,description,provider_id)
VALUES("65,644,645,646,647,648,649", "Diners Club", 713);
